import { registerPlugin } from '@capacitor/core';

// 커스텀 네이티브 플러그인 브리지 (iOS: SFSpeechURLRecognitionRequest, 온디바이스 파일 전사)
// 네이티브 구현: app/native/ios/FileTranscribePlugin.swift
// 웹에는 구현이 없으므로 호출하지 않는다(네이티브에서만 사용).

export interface FileTranscribeSegment {
  text: string;
  ts: number; // ms
}

export interface FileTranscribeResult {
  text: string;
  segments: FileTranscribeSegment[];
}

export interface FileTranscribePlugin {
  requestPermission(): Promise<{ granted: boolean }>;
  transcribe(options: { path: string; language?: string }): Promise<FileTranscribeResult>;
}

export const FileTranscribe = registerPlugin<FileTranscribePlugin>('FileTranscribe');
