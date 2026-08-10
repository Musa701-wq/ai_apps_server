# SmartCloset Bedrock Chat API — Integration Guide

Base URL: `https://apps-model-server.mirdemy.com`

---

## Overview

SmartCloset fashion chat now runs on **AWS Bedrock** using `openai.gpt-oss-120b-1:0`.  
Image generation (virtual try-on & outfit combo) still uses Gemini — unchanged.

---

## Authentication

All endpoints require the `x-api-key` header:

```
x-api-key: YOUR_SERVER_ACCESS_KEY
```

---

## Chat Endpoint

All three URLs below point to the **same Bedrock chat handler** — use whichever fits your app structure.

| URL | Notes |
|---|---|
| `POST /fashion-chat` | Direct mount |
| `POST /api/smartcloset/fashion-chat` | Prefixed route |
| `POST /api/gemini/chat` | Proxy route (Flutter app uses this) |

**Model:** `openai.gpt-oss-120b-1:0` via AWS Bedrock (`ap-south-1`)

---

## Request Body

```json
{
  "prompt": "What should I wear to a summer wedding?"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `prompt` | String | ✅ Yes | Fashion question or styling instruction |

---

## Response

**Success (200):**
```json
{
  "result": "For a summer wedding, I'd recommend a flowy midi dress in pastel tones...",
  "total_tokens": 312
}
```

| Field | Type | Description |
|---|---|---|
| `result` | String | AI generated fashion advice (text) |
| `total_tokens` | Number | Input + output tokens combined |

**Unauthorized (401):**
```json
{
  "error": "Unauthorized: Invalid or missing API key",
  "code": "AUTH_FAILED"
}
```

**Missing Field (400):**
```json
{
  "error": "prompt field is required",
  "code": "MISSING_FIELD"
}
```

**Server Error (500):**
```json
{
  "error": "Error description",
  "code": "SMARTCLOSET_CHAT_ERROR"
}
```

---

## Test with cURL

```bash
curl -X POST https://apps-model-server.mirdemy.com/api/gemini/chat \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_SERVER_ACCESS_KEY" \
  -d '{"prompt": "What colors go well with navy blue?"}'
```

---

## Flutter Integration

### `gemini_service.dart` — updated URL only, payload unchanged

```dart
final response = await http.post(
  Uri.parse('$baseUrl/api/gemini/chat'),
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': serverAccessKey,
  },
  body: jsonEncode({'prompt': prompt}),
);
```

### Full service class

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class SmartClosetChatService {
  static const String _baseUrl = 'https://apps-model-server.mirdemy.com';
  static const String _accessKey = 'YOUR_SERVER_ACCESS_KEY';

  static Future<Map<String, dynamic>> fashionChat({
    required String prompt,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/api/gemini/chat'),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': _accessKey,
      },
      body: jsonEncode({'prompt': prompt}),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return {
        'result': data['result'] ?? '',
        'total_tokens': data['total_tokens'] ?? 0,
      };
    } else if (response.statusCode == 401) {
      throw Exception('Unauthorized: Invalid API key');
    } else {
      final data = jsonDecode(response.body);
      throw Exception('API Error [${data['code']}]: ${data['error']}');
    }
  }
}
```

### Usage

```dart
try {
  var response = await SmartClosetChatService.fashionChat(
    prompt: 'What should I wear to a casual dinner?',
  );
  print(response['result']);        // fashion advice text
  print(response['total_tokens']); // for credit deduction
} on Exception catch (e) {
  print('Error: $e');
}
```

---

## Full Route Summary

| Endpoint | Method | Model | Provider | Type |
|---|---|---|---|---|
| `/api/gemini/chat` | POST | `openai.gpt-oss-120b-1:0` | AWS Bedrock | Text ✅ |
| `/api/smartcloset/fashion-chat` | POST | `openai.gpt-oss-120b-1:0` | AWS Bedrock | Text ✅ |
| `/fashion-chat` | POST | `openai.gpt-oss-120b-1:0` | AWS Bedrock | Text ✅ |
| `/api/gemini/image` | POST | `gemini-2.5-flash-image` | Google Gemini | Image ✅ |
| `/api/smartcloset/virtual-tryon` | POST | `gemini-2.5-flash-image` | Google Gemini | Image ✅ |
| `/api/smartcloset/outfit-combo` | POST | `gemini-2.5-flash-image` | Google Gemini | Image ✅ |
| `/virtual-tryon` | POST | `gemini-2.5-flash-image` | Google Gemini | Image ✅ |
| `/outfit-combo` | POST | `gemini-2.5-flash-image` | Google Gemini | Image ✅ |

---

## Server Environment Variables

```
BEDROCK_REGION=ap-south-1
BEDROCK_MODEL_ID=openai.gpt-oss-120b-1:0
BEDROCK_MAX_TOKENS=1024
BEDROCK_TEMPERATURE=0.4
AWS_BEARER_TOKEN_BEDROCK=your_token_here
```

---

## Error Codes Reference

| Code | HTTP Status | Description |
|---|---|---|
| `AUTH_FAILED` | 401 | Missing or invalid `x-api-key` |
| `MISSING_FIELD` | 400 | `prompt` not provided |
| `SMARTCLOSET_CHAT_ERROR` | 500 | AWS Bedrock call failed |
