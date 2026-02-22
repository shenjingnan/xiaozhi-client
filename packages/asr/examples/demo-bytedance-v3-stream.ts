import { ASR } from "../src/index.js";

const client = new ASR({
  bytedance: {
    v3: {},
  },
});

for await (const result of client.bytedance.v3.listen(audioStream)) {
  console.log(result.text, result.isFinal);
}
