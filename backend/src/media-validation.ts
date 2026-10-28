import sharp from "sharp";
import {MPEGDecoderWebWorker} from "mpg123-decoder";
import {assert,ApiError} from "./domain.js";

// Native image decoding and WASM audio work are bounded independently of uploads.
let validating=false;
sharp.cache(false);
sharp.concurrency(1);

function wav(body:Buffer) {
  assert(body.length>=44&&body.readUInt32LE(4)+8===body.length,400,"Invalid WAV length");
  let offset=12,alignment=0,hasData=false,hasFormat=false;
  while(offset<body.length){
    assert(offset+8<=body.length,400,"Truncated WAV chunk");
    const kind=body.toString("ascii",offset,offset+4),length=body.readUInt32LE(offset+4),start=offset+8,end=start+length;
    assert(end<=body.length,400,"Truncated WAV data");
    if(kind==="fmt "){
      assert(!hasFormat&&length>=16,400,"Invalid WAV format");hasFormat=true;
      const format=body.readUInt16LE(start),channels=body.readUInt16LE(start+2),rate=body.readUInt32LE(start+4),bytes=body.readUInt32LE(start+8),bits=body.readUInt16LE(start+14);
      alignment=body.readUInt16LE(start+12);
      assert([1,3].includes(format)&&channels>=1&&channels<=2&&rate>=8000&&rate<=192000,400,"Use PCM or IEEE-float mono/stereo WAV");
      assert((format===1?[8,16,24,32]:[32,64]).includes(bits)&&alignment===channels*bits/8&&bytes===rate*alignment,400,"Invalid WAV sample layout");
    }
    if(kind==="data"){assert(hasFormat&&length>0&&length%alignment===0,400,"Invalid WAV samples");hasData=true;}
    offset=end+(length%2);
  }
  assert(offset===body.length&&hasFormat&&hasData,400,"Incomplete WAV file");
}

function mp3Frames(body:Buffer) {
  let start=0,end=body.length;
  if(body.toString("ascii",0,3)==="ID3"){
    assert(body.length>=10&&[2,3,4].includes(body[3]!),400,"Invalid MP3 tags");
    const sizeBytes=body.subarray(6,10);assert(sizeBytes.every(n=>n<128),400,"Invalid MP3 tag length");
    start=10+sizeBytes.reduce((size,n)=>size*128+n,0)+(body[3]===4&&(body[5]!&16)?10:0);
    assert(start<=end,400,"Truncated MP3 tags");
  }
  if(end-start>=128&&body.toString("ascii",end-128,end-125)==="TAG")end-=128;
  if(end-start>=32&&body.toString("ascii",end-32,end-24)==="APETAGEX"){
    const size=body.readUInt32LE(end-20);assert(size>=32&&size<=end-start,400,"Invalid MP3 tags");end-=size;
    if(end-start>=32&&body.toString("ascii",end-32,end-24)==="APETAGEX")end-=32;
  }
  let offset=start,frames=0;
  while(offset<end){
    assert(offset+4<=end&&body[offset]===255&&(body[offset+1]!&224)===224,400,"Invalid MP3 frame");
    const version=(body[offset+1]!>>3)&3,layer=(body[offset+1]!>>1)&3,bitrate=body[offset+2]!>>4,frequency=(body[offset+2]!>>2)&3,padding=(body[offset+2]!>>1)&1;
    assert(version!==1&&layer===1&&bitrate>0&&bitrate<15&&frequency<3,400,"Use a valid MPEG Layer III MP3");
    const rate=[44100,48000,32000][frequency]!/(version===3?1:version===2?2:4);
    const kbps=(version===3?[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320]:[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160])[bitrate]!;
    offset+=Math.floor((version===3?144000:72000)*kbps/rate)+padding;
    assert(offset<=end,400,"Truncated MP3 frame");frames++;
  }
  assert(frames>=2&&offset===end,400,"MP3 contains no complete audio stream");
  return body.subarray(start,end);
}

export async function validateMedia(body:Buffer):Promise<{body:Buffer;contentType:string}> {
  assert(!validating,503,"Media validation is busy. Try again shortly");validating=true;
  try{
    const isImage=body.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||(body[0]===255&&body[1]===216&&body[2]===255)||(body.toString("ascii",0,4)==="RIFF"&&body.toString("ascii",8,12)==="WEBP");
    if(isImage){
      const image=sharp(body,{failOn:"warning",limitInputPixels:16_000_000,animated:false});
      const meta=await image.metadata();assert(["png","jpeg","webp"].includes(meta.format??"")&&(meta.pages??1)===1,400,"Use a single PNG, JPEG or WebP image");
      const bytes=await image.rotate().toFormat(meta.format as "png"|"jpeg"|"webp").toBuffer();
      assert(bytes.length<=20*1024*1024,400,"Decoded image exceeds the media limit");
      return {body:bytes,contentType:`image/${meta.format}`};
    }
    if(body.toString("ascii",0,4)==="RIFF"&&body.toString("ascii",8,12)==="WAVE"){wav(body);return {body,contentType:"audio/wav"};}
    if(body.toString("ascii",0,3)==="ID3"||(body[0]===255&&(body[1]!&224)===224)){
      const frames=mp3Frames(body),decoder=new MPEGDecoderWebWorker();
      try{await decoder.ready;let samples=0;
        for(let i=0;i<frames.length;i+=16384){const decoded=await decoder.decode(frames.subarray(i,i+16384));assert(decoded.errors.length===0,400,"MP3 audio could not be decoded");samples+=decoded.samplesDecoded;}
        assert(samples>0,400,"MP3 has no decodable audio");return {body:frames,contentType:"audio/mpeg"};
      }finally{await decoder.free();}
    }
    throw new ApiError(400,"Use PNG, JPEG, WebP, MP3 or WAV files");
  }catch(error){if(error instanceof ApiError)throw error;throw new ApiError(400,"Media could not be decoded. Choose a valid image or audio file");}
  finally{validating=false;}
}
