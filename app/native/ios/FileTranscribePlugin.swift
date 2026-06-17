import Foundation
import Capacitor
import Speech

// MeetNote 커스텀 플러그인: 오디오 "파일"을 온디바이스로 전사한다.
// Web Speech/실시간 인식과 달리 SFSpeechURLRecognitionRequest는 파일 전사를 지원하므로
// 가져온 녹음 파일/저장된 녹음을 원거리·장시간이라도 회의록으로 받아쓸 수 있다.
//
// 설치: `npx cap add ios` 후 이 파일을 ios/App/App/ 에 추가(드래그&드롭, App 타깃 체크).
// Info.plist에 NSSpeechRecognitionUsageDescription, NSMicrophoneUsageDescription 필요.

@objc(FileTranscribePlugin)
public class FileTranscribePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FileTranscribePlugin"
    public let jsName = "FileTranscribe"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "transcribe", returnType: CAPPluginReturnPromise)
    ]

    @objc func requestPermission(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { status in
            call.resolve(["granted": status == .authorized])
        }
    }

    @objc func transcribe(_ call: CAPPluginCall) {
        guard let path = call.getString("path") else {
            call.reject("path required"); return
        }
        let lang = call.getString("language") ?? "ko-KR"

        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: lang)) else {
            call.reject("recognizer locale unavailable"); return
        }
        guard recognizer.isAvailable else {
            call.reject("recognizer not available"); return
        }

        // path는 file:// URI (Capacitor Filesystem이 준 uri)
        let url = URL(string: path) ?? URL(fileURLWithPath: path)
        let request = SFSpeechURLRecognitionRequest(url: url)
        request.shouldReportPartialResults = false
        if recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }
        if #available(iOS 16.0, *) {
            request.addsPunctuation = true
        }

        recognizer.recognitionTask(with: request) { result, error in
            if let error = error {
                call.reject("transcribe failed: \(error.localizedDescription)")
                return
            }
            guard let result = result, result.isFinal else { return }

            let transcription = result.bestTranscription

            // 토큰(세그먼트)을 문장 단위로 병합: 문장부호 종료 또는 ~8초 경과 시 끊는다.
            var segments: [[String: Any]] = []
            var current = ""
            var startTs: Double = 0

            let tokens = transcription.segments
            for (i, seg) in tokens.enumerated() {
                if current.isEmpty { startTs = seg.timestamp }
                current += (current.isEmpty ? "" : " ") + seg.substring

                let endsSentence = seg.substring.range(of: "[.?!。…]$", options: .regularExpression) != nil
                let spanned = (seg.timestamp + seg.duration) - startTs
                let isLast = (i == tokens.count - 1)

                if endsSentence || spanned > 8.0 || isLast {
                    let text = current.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !text.isEmpty {
                        segments.append(["text": text, "ts": Int(startTs * 1000)])
                    }
                    current = ""
                }
            }

            call.resolve([
                "text": transcription.formattedString,
                "segments": segments
            ])
        }
    }
}
