import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zentra_mobile/features/anecdotal/anecdotal_data.dart';

void main() {
  test('category colors match web CATEGORY_COLORS', () {
    expect(anecdotalCategoryColor('behavioral'), const Color(0xFFF59E0B));
    expect(anecdotalCategoryColor('bullying'), const Color(0xFFEF4444));
    expect(anecdotalCategoryColor('academic'), const Color(0xFF3B82F6));
    expect(anecdotalCategoryColor('attendance'), const Color(0xFF22C55E));
    expect(anecdotalCategoryColor('health'), const Color(0xFF8B5CF6));
  });

  test('category color lookup is case-insensitive with gray fallback', () {
    expect(anecdotalCategoryColor('Behavioral'), const Color(0xFFF59E0B));
    expect(anecdotalCategoryColor('  HEALTH '), const Color(0xFF8B5CF6));
    expect(anecdotalCategoryColor('unknown-thing'), const Color(0xFF8A8A8A));
    expect(anecdotalCategoryColor(null), const Color(0xFF8A8A8A));
    expect(anecdotalCategoryColor(''), const Color(0xFF8A8A8A));
  });

  test('category labels match web with humanized fallback', () {
    expect(anecdotalCategoryLabel('bullying'), 'Bullying');
    expect(anecdotalCategoryLabel('attendance'), 'Attendance');
    expect(anecdotalCategoryLabel('some_thing'), 'Some Thing');
    expect(anecdotalCategoryLabel(null), '—');
  });
}
