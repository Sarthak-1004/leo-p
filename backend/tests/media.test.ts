import {test} from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {validateMedia} from "../src/media-validation.js";

test("permitted images are fully decoded, normalized and stripped of metadata",async()=>{
  for(const format of ["png","jpeg","webp"] as const){
    const source=await sharp({create:{width:4,height:3,channels:3,background:"white"}}).withMetadata({density:144}).toFormat(format).toBuffer();
    const saved=await validateMedia(source),meta=await sharp(saved.body).metadata();
    assert.equal(saved.contentType,`image/${format}`);assert.equal(meta.width,4);assert.equal(meta.height,3);assert.equal(meta.exif,undefined);assert.equal(meta.icc,undefined);
  }
});
test("malformed and truncated permitted signatures are rejected",async()=>{
  for(const body of [Buffer.from([137,80,78,71,13,10,26,10]),Buffer.from([255,216,255,0]),Buffer.from("RIFF0000WEBPnot-a-webp"),Buffer.from("ID3not-audio"),Buffer.from("RIFF0000WAVEnot-a-wave"),Buffer.from('<svg onload="alert(1)"></svg>')])await assert.rejects(()=>validateMedia(body));
  const image=await sharp({create:{width:4,height:4,channels:3,background:"red"}}).png().toBuffer();await assert.rejects(()=>validateMedia(image.subarray(0,35)));
});
test("images with excessive declared dimensions fail before full decoding",async()=>{
  const image=await sharp({create:{width:2,height:2,channels:3,background:"red"}}).png().toBuffer();image.writeUInt32BE(200000,16);image.writeUInt32BE(200000,20);
  await assert.rejects(()=>validateMedia(image));
});
function wave(){const b=Buffer.alloc(48);b.write("RIFF");b.writeUInt32LE(40,4);b.write("WAVEfmt ",8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write("data",36);b.writeUInt32LE(4,40);return b;}
test("WAV requires a complete PCM sample layout and rejects truncated or inconsistent chunks",async()=>{
  const b=wave();assert.equal((await validateMedia(b)).contentType,"audio/wav");
  await assert.rejects(()=>validateMedia(b.subarray(0,46)));
  const invalid=wave();invalid.writeUInt32LE(999,40);await assert.rejects(()=>validateMedia(invalid));
  const mismatch=wave();mismatch.writeUInt16LE(3,32);await assert.rejects(()=>validateMedia(mismatch));
});
test("MP3 frames are structurally validated and decoded, with tags removed",async()=>{
  // Valid MPEG-1 Layer III silence frames; no external/licensed audio involved.
  const frame=Buffer.alloc(417);frame.set([255,251,144,0]);const audio=Buffer.concat(Array.from({length:6},()=>frame));
  const tag=Buffer.from([73,68,51,4,0,0,0,0,0,0]);
  const saved=await validateMedia(Buffer.concat([tag,audio]));assert.equal(saved.contentType,"audio/mpeg");assert.deepEqual(saved.body,audio);
  await assert.rejects(()=>validateMedia(audio.subarray(0,audio.length-1)));
  await assert.rejects(()=>validateMedia(Buffer.concat([audio,Buffer.from("not audio")])));
});
