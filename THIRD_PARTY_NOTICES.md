# 서드파티 라이선스 고지 (Third-Party Notices)

ClaudeTower 배포판(SEA 실행 파일)은 아래 서드파티 소프트웨어를 함께 포함합니다. ClaudeTower 자체의 라이선스(Apache License 2.0)는 `LICENSE` 파일을 참고하세요.

---

## @napi-rs/keyring

- **용도**: Account 모듈의 OS 자격증명 저장소(Windows Credential Manager, macOS Keychain, Linux Secret Service) 접근. `keyring-native-*.node`로 실행 파일과 함께 배포됩니다.
- **라이선스**: MIT License
- **저작권**: Copyright (c) 2020 N-API for Rust

```
MIT License

Copyright (c) 2020 N-API for Rust

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

이 파일은 배포판에 실제로 포함되는(코드에 링크되거나 함께 실행되는) 서드파티 구성요소만 다룹니다. 빌드/개발 도구(`esbuild`, `eslint`)는 실행 파일에 포함되지 않으므로 이 목록에서 제외합니다.
