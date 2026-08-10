# Labmate API — Integration Guide

Base URL: `https://apps-model-server.mirdemy.com`

---

## Authentication (NEW)

Sare endpoints protected hain. Har request mein `x-api-key` header bhejni zaroori hai warna `401 Unauthorized` aayega.

```
x-api-key: musa-secret-2025
```

> Ye key `.env` file mein `SERVER_ACCESS_KEY` ke naam se store hai. Isko apni marzi se change kar sakte ho.

---

## Endpoints

### 1. MRI Analysis
**POST** `/api/labmate/mri`  
Model: `gemini-2.5-flash`  
Use: MRI scan analysis

### 2. X-ray / ECG / Lab Reports
**POST** `/api/labmate/report`  
Model: `gemini-2.5-flash`  
Use: X-ray, ECG, Laboratory report analysis

### 3. General Gemini
**POST** `/api/gemini`  
Model: `gemini-2.5-flash`  
Use: General purpose AI queries

---

## Request Body

```json
{
  "prompt": "Analyze this scan and describe findings",
  "image_base64": "base64_encoded_image_string",
  "mime_type": "image/jpeg"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `prompt` | String | ✅ Yes | Question or instruction for the model |
| `image_base64` | String | ❌ Optional | Image encoded in Base64 |
| `mime_type` | String | ❌ Optional | `image/jpeg`, `image/png`, `image/webp` |

---

## Response

**Success (200):**
```json
{
  "result": "AI generated analysis text here..."
}
```

**Unauthorized (401):**
```json
{
  "error": "Unauthorized: Invalid or missing API key"
}
```

---

## Test with cURL

**Bina key — 401 aayega:**
```bash
curl -X POST https://apps-model-server.mirdemy.com/api/labmate/mri \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is MRI?"}'
```

**Sahi key ke saath — kaam karega:**
```bash
curl -X POST https://apps-model-server.mirdemy.com/api/labmate/mri \
  -H "Content-Type: application/json" \
  -H "x-api-key: musa-secret-2025" \
  -d '{"prompt": "What is MRI?"}'
```

```bash
curl -X POST https://apps-model-server.mirdemy.com/api/labmate/report \
  -H "Content-Type: application/json" \
  -H "x-api-key: musa-secret-2025" \
  -d '{"prompt": "Explain what an ECG report shows."}'
```

---

## Flutter Integration

### 1. Add dependency in `pubspec.yaml`
```yaml
dependencies:
  http: ^1.2.0
```

### 2. Create `labmate_service.dart`

```dart
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class LabmateService {
  static const String _baseUrl = 'https://apps-model-server.mirdemy.com';
  static const String _accessKey = 'musa-secret-2025'; // SERVER_ACCESS_KEY

  /// MRI Analysis — gemini-2.0-flash
  static Future<String> analyzeMRI({
    required String prompt,
    File? imageFile,
  }) async {
    return await _call(
      endpoint: '/api/labmate/mri',
      prompt: prompt,
      imageFile: imageFile,
    );
  }

  /// X-ray / ECG / Lab Report — gemma-4-26b-a4b-it
  static Future<String> analyzeReport({
    required String prompt,
    File? imageFile,
  }) async {
    return await _call(
      endpoint: '/api/labmate/report',
      prompt: prompt,
      imageFile: imageFile,
    );
  }

  /// General Gemini — gemini-2.5-flash
  static Future<String> ask(String prompt) async {
    return await _call(
      endpoint: '/api/gemini',
      prompt: prompt,
    );
  }

  static Future<String> _call({
    required String endpoint,
    required String prompt,
    File? imageFile,
  }) async {
    final Map<String, dynamic> body = {'prompt': prompt};

    if (imageFile != null) {
      final bytes = await imageFile.readAsBytes();
      final base64Image = base64Encode(bytes);
      final mimeType = _getMimeType(imageFile.path);
      body['image_base64'] = base64Image;
      body['mime_type'] = mimeType;
    }

    final response = await http.post(
      Uri.parse('$_baseUrl$endpoint'),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': _accessKey, // Auth header
      },
      body: jsonEncode(body),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data['result'] ?? 'No result';
    } else if (response.statusCode == 401) {
      throw Exception('Unauthorized: Invalid API key');
    } else {
      throw Exception('API Error: ${response.body}');
    }
  }

  static String _getMimeType(String path) {
    if (path.endsWith('.png')) return 'image/png';
    if (path.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }
}
```

### 3. Usage Examples

**MRI — text only:**
```dart
String result = await LabmateService.analyzeMRI(
  prompt: 'What abnormalities can you detect in this MRI?',
);
```

**MRI — with image:**
```dart
File imageFile = File('/path/to/mri_scan.jpg');

String result = await LabmateService.analyzeMRI(
  prompt: 'Analyze this MRI scan for any abnormalities.',
  imageFile: imageFile,
);
```

**X-ray / ECG / Lab Report:**
```dart
File xray = File('/path/to/xray.jpg');

String result = await LabmateService.analyzeReport(
  prompt: 'Describe the findings in this chest X-ray.',
  imageFile: xray,
);
```

---

## Error Handling

```dart
try {
  String result = await LabmateService.analyzeMRI(
    prompt: 'Analyze this scan.',
    imageFile: imageFile,
  );
  print(result);
} catch (e) {
  print('Error: $e');
}
```

---

## Supported Image Formats

| Format | mime_type |
|---|---|
| JPEG / JPG | `image/jpeg` |
| PNG | `image/png` |
| WebP | `image/webp` |

---

## Security Notes

- `x-api-key` header ke bina koi bhi request `401` return karegi
- Key ko Flutter app mein hardcode karne ki bajaye `flutter_dotenv` ya `--dart-define` se manage karo production mein
- `SERVER_ACCESS_KEY` server ki `.env` file mein hai — kabhi public mat karo
