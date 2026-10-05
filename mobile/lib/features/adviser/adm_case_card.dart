// Shared ADM case card + 8-stage pipeline order.
// Web parity: frontend/src/app/teacher/advisory/adm-cases/components/
// adm-cases-data.ts (ADM_STAGES) + AdmCaseRail.tsx ("Stage N of 8").
// Status-only, never clinical detail.

import 'package:flutter/material.dart';

import '../../shared/widgets.dart';

const admStageOrder = {
  'anecdotal': 1,
  'consultation': 2,
  'meeting_parents': 3,
  'home_visitation': 4,
  'certification': 5,
  'principal_approval': 6,
  'enrollment_monitoring': 7,
  'completion': 8,
};

int admOrderOf(String stage) => admStageOrder[stage] ?? 2;

class AdmCaseCard extends StatelessWidget {
  final Map<String, dynamic> caseData;
  final VoidCallback? onTap;
  const AdmCaseCard({super.key, required this.caseData, this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final stage = caseData['stage']?.toString() ?? '';
    final stageLabel = caseData['stageLabel']?.toString() ?? stage;
    final eligibility = caseData['eligibilityStatus']?.toString() ?? 'pending';
    final timeline = (caseData['timeline'] as List? ?? []);
    final modulesSub = caseData['modulesSubmitted']?.toString() ?? '0';
    final modulesTotal = caseData['modulesTotal']?.toString() ?? '0';
    final approved = caseData['approved'] == true;
    final name = caseData['studentName']?.toString() ?? '';
    final lrn = caseData['lrn']?.toString() ?? '';
    final card = ZCard(
      padding: EdgeInsets.zero,
      child: ExpansionTile(
        dense: true,
        leading: Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(shape: BoxShape.circle, color: approved ? const Color(0xFF22C55E) : const Color(0xFFF59E0B)),
        ),
        title: Text(name.isEmpty ? (stageLabel.isEmpty ? 'ADM case' : stageLabel) : name,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        subtitle: Text(
          name.isEmpty
              ? 'Eligibility: $eligibility · Modules $modulesSub/$modulesTotal'
              : 'LRN $lrn · Stage ${admOrderOf(stage)} of 8 · $eligibility',
          style: theme.textTheme.bodySmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
        ),
        children: [
          if (timeline.isEmpty)
            const Padding(padding: EdgeInsets.fromLTRB(16, 0, 16, 12), child: Text('No timeline entries yet.', style: TextStyle(fontSize: 13)))
          else
            for (final t in timeline)
              ListTile(
                dense: true,
                title: Text((t as Map)['label']?.toString() ?? '', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                subtitle: Text(
                  '${(t['date'] ?? t['at'] ?? '').toString()}${(t['detail']?.toString().isNotEmpty ?? false) ? ' · ${t['detail']}' : ''}',
                  style: theme.textTheme.bodySmall,
                ),
              ),
        ],
      ),
    );
    if (onTap == null) return card;
    return InkWell(borderRadius: BorderRadius.circular(6), onTap: onTap, child: card);
  }
}
