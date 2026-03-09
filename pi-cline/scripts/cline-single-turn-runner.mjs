import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

function injectClineEntrySource(source) {
  const helperSource = [
    'function __piSafeSerialize(t){try{return JSON.parse(JSON.stringify(t,(_,e)=>typeof e==="bigint"?String(e):e))}catch{return String(t??"")}}',
    'function __piEmitCall(t){try{process.stderr.write("__PI_CAPTURE_CALL__"+JSON.stringify(t)+"\\n")}catch{}}',
    'async function __piRecordChatCompletions(t,e){let a={scope:"https://api.cline.bot",method:"POST",path:"/v1/chat/completions",body:__piSafeSerialize(e),status:200,response:"",rawHeaders:{"content-type":"application/json"},reqheaders:{"content-type":"application/json"}};try{let r=t?.baseURL||t?.baseUrl||t?._options?.baseURL||t?._options?.baseUrl||t?._client?.baseURL||t?._client?.baseUrl;if(r){let o=new URL(String(r)),c=o.pathname.endsWith("/")?o.pathname.slice(0,-1):o.pathname;a.scope=o.origin,a.path=`${c}/chat/completions`}}catch{}let n;try{n=await t.chat.completions.create(e)}catch(r){a.status=Number(r?.status??r?.response?.status??500),a.response=__piSafeSerialize(r?.response?.data??{message:r?.message??String(r)}),__piEmitCall(a);throw r}if(n&&typeof n[Symbol.asyncIterator]=="function"){let r=[];async function* o(){try{for await(let c of n)r.push(__piSafeSerialize(c)),yield c}finally{a.response=r,__piEmitCall(a)}}return o()}return a.response=__piSafeSerialize(n),__piEmitCall(a),n}',
  ].join("\n");

  if (source.startsWith("#!")) {
    const newlineIndex = source.indexOf("\n");
    if (newlineIndex === -1) {
      return `${source}\n${helperSource}\n`;
    }

    const [before, after] = source.split("\n", 2);
    return `${before}\n${helperSource}\n${after}`;
  }

  return `${helperSource}\n${source}`;
}

function patchClineEntrySource(source) {
  const callPattern = /return await (\w+)\.chat\.completions\.create\((\w+)\)/g;
  if (!source.match(callPattern)) {
    throw new Error(
      "Failed to patch cline entry: no call-sites matched by pattern",
    );
  }

  return injectClineEntrySource(source).replace(
    callPattern,
    (_, client, params) =>
      `return await __piRecordChatCompletions(${client},${params})`,
  );
}

async function main() {
  const clineArgsJson = process.env.CLINE_RUNNER_ARGS_JSON;
  if (!clineArgsJson) {
    throw new Error("Missing env: CLINE_RUNNER_ARGS_JSON");
  }
  const clineEntry = process.env.CLINE_RUNNER_ENTRY;
  if (!clineEntry) {
    throw new Error("Missing env: CLINE_RUNNER_ENTRY");
  }

  const clineArgs = JSON.parse(clineArgsJson);

  process.once("SIGINT", () => process.exit(130));
  process.once("SIGTERM", () => process.exit(143));

  const patchedEntry = `${clineEntry}.pi-runner-${process.pid}-${Date.now()}.mjs`;

  try {
    const originalSource = readFileSync(clineEntry, "utf8");
    const patchedSource = patchClineEntrySource(originalSource);
    writeFileSync(patchedEntry, patchedSource);

    process.argv = [process.execPath, patchedEntry, ...clineArgs];
    await import(`${pathToFileURL(patchedEntry).href}?run=${Date.now()}`);
  } finally {
    try {
      rmSync(patchedEntry, { force: true });
    } catch {}
  }
}

await main();
