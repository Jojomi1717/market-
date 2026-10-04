import { pipeline, env } from '@huggingface/transformers';
import fs from 'fs';
env.allowRemoteModels = false;
env.localModelPath = './node_modules/sts-whisper-base/models/';
// 16 kHz mono float32 raw
const raw = fs.readFileSync('voice.f32');
const audio = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
const asr = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base', { dtype: 'q8' });
const out = await asr(audio, { language: 'french', task: 'transcribe', return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5 });
console.log(out.text);
fs.writeFileSync('words.json', JSON.stringify(out.chunks.map(c => ({ w: c.text.trim(), s: c.timestamp[0], e: c.timestamp[1] }))));
console.log(out.chunks.map(c => `${c.text.trim()}@${c.timestamp[0]?.toFixed(2)}`).join(' '));
