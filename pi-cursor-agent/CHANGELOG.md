# Changelog

## 0.4.1 (2026-03-20)

### Features

* Add overlay state for stream internal ([6104f7f](https://github.com/sudosubin/pi-frontier/commit/6104f7faac0bdab5b3686981dadad698f6313b76))
* Add semantic tool registry ([0f2ef40](https://github.com/sudosubin/pi-frontier/commit/0f2ef40440a4729df0aabd5129606756f093522b))
* Add state store for managing tool call ([80877a2](https://github.com/sudosubin/pi-frontier/commit/80877a2cce712b3f60652c6b53f6a0ead460d557))
* Clean up session map memory after session change ([11a8ada](https://github.com/sudosubin/pi-frontier/commit/11a8adadbc9a36f18001b5c06034c28f04110f4d))
* Update models and model variants ([ad0faea](https://github.com/sudosubin/pi-frontier/commit/ad0faea4b4c2c6185ac41c666943f7022fb415e6))

### Bug Fixes

* Add abort error handler for AgentService ([#5](https://github.com/sudosubin/pi-frontier/issues/5)) ([333df28](https://github.com/sudosubin/pi-frontier/commit/333df288170d78bcdd3501e971ea4016cd20788c))
* Preserve cursor conversation state across continued sessions ([#6](https://github.com/sudosubin/pi-frontier/issues/6)) ([5e6fb80](https://github.com/sudosubin/pi-frontier/commit/5e6fb8061ce809b962b5d7c72a2512891a5beb36))
* Transform cursor tool to pi tool ([e0326c1](https://github.com/sudosubin/pi-frontier/commit/e0326c13e1392a5a5775e9883505d12f5d77bd99))

## [0.4.0](https://github.com/sudosubin/pi-frontier/compare/pi-cursor-agent@0.3.0...pi-cursor-agent@0.4.0) (2026-02-17)
## [0.3.0](https://github.com/sudosubin/pi-frontier/compare/pi-cursor-agent@0.2.2...pi-cursor-agent@0.3.0) (2026-02-17)
## [0.2.2](https://github.com/sudosubin/pi-frontier/compare/pi-cursor-agent@0.2.1...pi-cursor-agent@0.2.2) (2026-02-17)

### Bug Fixes

* **pi-cursor-agent:** Fix repository directory ([2bc274c](https://github.com/sudosubin/pi-frontier/commit/2bc274c2c850026076117d55926c041f6392418e))
## [0.2.1](https://github.com/sudosubin/pi-frontier/compare/pi-cursor-agent@0.2.0...pi-cursor-agent@0.2.1) (2026-02-17)

### Bug Fixes

* **pi-cursor-agent:** Fix repository url ([49412c6](https://github.com/sudosubin/pi-frontier/commit/49412c6e76b88151c9c98488fe27c28fb8e0a98c))
## [0.2.0](https://github.com/sudosubin/pi-frontier/compare/pi-cursor-agent@0.1.3...pi-cursor-agent@0.2.0) (2026-02-17)

### Features

* **pi-cursor-agent:** Migrated into pi-cursor-agent directory ([b9aebe6](https://github.com/sudosubin/pi-frontier/commit/b9aebe6eab842d5d8a229fc630d0825148bce504))
* **pi-cursor-agent:** Rename cursor to cursor-agent ([aa39f86](https://github.com/sudosubin/pi-frontier/commit/aa39f861c2d67a0f0116e787d3bcb4eda3373067))
## [0.1.3](https://github.com/sudosubin/pi-frontier/compare/pi-cursor-agent@0.1.2...pi-cursor-agent@0.1.3) (2026-02-13)

### Features

* Add cursor models cache ttl support ([3deb493](https://github.com/sudosubin/pi-frontier/commit/3deb493a37a623b5cc247e69ad482c2faf871805))
## [0.1.2](https://github.com/sudosubin/pi-frontier/compare/pi-cursor-agent@0.1.1...pi-cursor-agent@0.1.2) (2026-02-11)

### Features

* Add composer-1.5, gpt-5.3-codex, gpt-5.3-codex-fast models ([d5b167a](https://github.com/sudosubin/pi-frontier/commit/d5b167a4c102c94db6aed3a67e259b38c96609ee))
## [0.1.1](https://github.com/sudosubin/pi-frontier/compare/pi-cursor-agent@0.1.0...pi-cursor-agent@0.1.1) (2026-02-07)
## [0.1.0](https://github.com/sudosubin/pi-frontier/compare/43e747fbf904869c675d64a291cb8933454bda4a...pi-cursor-agent@0.1.0) (2026-02-07)

### Features

* Add agent service for running agent ([60408d7](https://github.com/sudosubin/pi-frontier/commit/60408d730cfd9d4559f1e58e607ae57ebbf6a8be))
* Add aiserver.v1 proto ([7d8e8de](https://github.com/sudosubin/pi-frontier/commit/7d8e8de642217fbeeeb4f1f35436c65b444a6d11))
* Add api/auth.ts module for auth apis ([cf4f1e8](https://github.com/sudosubin/pi-frontier/commit/cf4f1e82738f107edc6609ee60832d4e09084131))
* Add auth manager for login and refresh ([09153b0](https://github.com/sudosubin/pi-frontier/commit/09153b0cf052efa681b5882439a18d380ff81baa))
* Add cursor-agent proto files and buf config file ([43e747f](https://github.com/sudosubin/pi-frontier/commit/43e747fbf904869c675d64a291cb8933454bda4a))
* Add gitignore file for npm project ([78d7de0](https://github.com/sudosubin/pi-frontier/commit/78d7de01dd5c706924690c52c3b4232642bdeed6))
* Add mcp tool support ([6ba7a45](https://github.com/sudosubin/pi-frontier/commit/6ba7a45218332bb57373ce2fa627ac1ed8130fa8))
* Add package.json, package-lock.json with minimal options ([73cc031](https://github.com/sudosubin/pi-frontier/commit/73cc031f8d06de0fae65bbb7f41777df866024aa))
* Add ResumeAction based on checkpoint ([8e6abb1](https://github.com/sudosubin/pi-frontier/commit/8e6abb1d2aa40bc1fa66502134825a96c0f59df1))
* Add typecheck using tsc ([b6e0310](https://github.com/sudosubin/pi-frontier/commit/b6e0310037fd4ad0cc3d8e7a844f08d2093c5709))
* Change to use canonical model id and map thinkg levels ([055c5a8](https://github.com/sudosubin/pi-frontier/commit/055c5a8e1211a0fe468ef329d6d4b0aa97b358d6))
* Generate cursor-agent proto files with buf ([9e33ec6](https://github.com/sudosubin/pi-frontier/commit/9e33ec60a3418a6cef1aacbcfe4193dc1e6fee22))
* Implement first cursor-agent provider with vendor ([2df588d](https://github.com/sudosubin/pi-frontier/commit/2df588d8f4c0aed96d5a4fed1785291ed826062d))

### Bug Fixes

* Fix to encode McpToolDefinition.inputSchema as protobuf Value binary ([88f059e](https://github.com/sudosubin/pi-frontier/commit/88f059e19b5f5a9408480395be7098caaf392ca0))
