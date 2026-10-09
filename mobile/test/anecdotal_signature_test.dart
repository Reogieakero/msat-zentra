import 'package:flutter_test/flutter_test.dart';
import 'package:zentra_mobile/features/anecdotal/signature_block.dart';

void main() {
  test('parses canonical signature object', () {
    final sig = recordSignatureOf({
      'signature': {'by': 'Jane Doe', 'at': '2026-09-05T00:00:00.000Z', 'imageUrl': 'data:image/png;base64,AAA'},
    });
    expect(sig, isNotNull);
    expect(sig!.by, 'Jane Doe');
    expect(sig.imageUrl, startsWith('data:image'));
  });

  test('falls back to legacy mobile keys', () {
    final sig = recordSignatureOf({
      'signedBy': 'John Cruz',
      'signedAt': '2026-09-05',
      'signatureImageUrl': 'https://example.com/sig.png',
    });
    expect(sig, isNotNull);
    expect(sig!.by, 'John Cruz');
    expect(sig.imageUrl, 'https://example.com/sig.png');
  });

  test('returns null while unsigned', () {
    expect(recordSignatureOf({'signature': null}), isNull);
    expect(recordSignatureOf({}), isNull);
    expect(recordSignatureOf({'signature': {'imageUrl': ''}}), isNull);
  });

  test('signatureImageOf handles data urls, http, and junk', () {
    expect(signatureImageOf(null), isNull);
    expect(signatureImageOf(''), isNull);
    expect(signatureImageOf('not-a-url-but-http-less'), isNotNull);
    expect(signatureImageOf('https://example.com/sig.png'), isNotNull);
    expect(signatureImageOf('data:image/png;base64,!!!'), isNull);
  });
}
