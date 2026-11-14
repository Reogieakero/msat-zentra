import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/session.dart';
import '../../shared/models.dart';
import '../../shared/user_messages.dart';
import '../../shared/widgets.dart';
import 'auth_flow_ui.dart';

String? termStatus(Term term, DateTime now) {
  final start = term.startDate;
  final end = term.endDate;
  if (start == null || end == null || end.isBefore(start)) return null;
  if (now.isBefore(start)) return 'Upcoming';
  if (now.isAfter(end)) return 'Ended';
  return 'Ongoing';
}

Term? defaultTerm(List<SchoolYear> years, DateTime now) {
  for (final year in years) {
    for (final term in year.terms) {
      if (termStatus(term, now) == 'Ongoing') return term;
    }
  }
  if (years.isEmpty) return null;
  final year = years.where((year) => year.isActive).firstOrNull ?? years.first;
  final terms = [...year.terms]
    ..sort((a, b) => a.termNumber.compareTo(b.termNumber));
  return terms.firstOrNull;
}

class TermSelectPage extends ConsumerStatefulWidget {
  const TermSelectPage({super.key});

  @override
  ConsumerState<TermSelectPage> createState() => _TermSelectPageState();
}

class _TermSelectPageState extends ConsumerState<TermSelectPage>
    with SingleTickerProviderStateMixin {
  late final _entrance = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 460),
    reverseDuration: const Duration(milliseconds: 300),
  );
  late final _opacity = _entrance.drive(CurveTween(curve: Curves.easeOut));
  late final _position = Tween(
    begin: const Offset(0, 0.025),
    end: Offset.zero,
  ).animate(_entrance.drive(CurveTween(curve: Curves.easeOutCubic)));
  String? _yearId;
  String? _termId;
  String? _error;
  bool _saving = false;
  bool _entered = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_saving && MediaQuery.disableAnimationsOf(context)) {
      _entrance.value = 1;
      _entered = true;
    } else if (!_entered) {
      _entered = true;
      _entrance.forward();
    }
  }

  @override
  void dispose() {
    _entrance.dispose();
    super.dispose();
  }

  Future<void> _continue(Term selected, SchoolYear year) async {
    if (_saving) return;
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      if (!reduceMotion) {
        await _entrance.reverse(from: 1).orCancel;
      }
      if (!mounted) return;
      await ref
          .read(termProvider.notifier)
          .select(
            Term(
              id: selected.id,
              schoolYearId: year.id,
              schoolYearName: year.name,
              termNumber: selected.termNumber,
              startDate: selected.startDate,
              endDate: selected.endDate,
            ),
          );
      if (mounted) context.go('/gate');
    } on TickerCanceled {
      // The route was disposed during its exit animation; never persist a pick.
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = userMessage(
          error,
          fallback: 'We couldn’t open this term. Please try again.',
        );
      });
      if (reduceMotion) {
        _entrance.value = 1;
      } else {
        _entrance.forward();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final years = ref.watch(schoolYearsProvider);
    final current = ref.watch(termProvider);
    return PopScope(
      canPop: !_saving,
      child: AuthFlowScaffold(
        child: FadeTransition(
          opacity: _opacity,
          child: SlideTransition(
            position: _position,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'YOUR WORKSPACE',
                  style: TextStyle(
                    color: authMint,
                    fontSize: 10,
                    letterSpacing: 1.8,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                Text.rich(
                  TextSpan(
                    children: [
                      const TextSpan(text: 'Select '),
                      TextSpan(
                        text: 'term',
                        style: TextStyle(
                          foreground: Paint()
                            ..shader = const LinearGradient(
                              colors: [authMint, Color(0xffa99cff)],
                            ).createShader(const Rect.fromLTWH(0, 0, 180, 40)),
                        ),
                      ),
                    ],
                  ),
                  style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w300,
                    letterSpacing: -1,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Choose which term your workspace will display.',
                  style: TextStyle(color: authMuted, fontSize: 14, height: 1.6),
                ),
                const SizedBox(height: 28),
                years.when(
                  loading: () =>
                      const AuthLoading(label: 'Loading school years…'),
                  error: (error, _) => ErrorView(
                    message: error,
                    onRetry: () => ref.invalidate(schoolYearsProvider),
                  ),
                  data: (list) => _content(list, current),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _content(List<SchoolYear> years, Term? current) {
    if (years.isEmpty) {
      return const ZEmpty(
        icon: Icons.calendar_month_outlined,
        title: 'No school years yet',
        subtitle: 'Please ask the school office to set up a school year before continuing.',
      );
    }
    final now = DateTime.now();
    final validCurrent = years
        .expand((year) => year.terms)
        .where(
          (term) =>
              term.id == current?.id &&
              term.schoolYearId == current?.schoolYearId,
        )
        .firstOrNull;
    final initial = validCurrent ?? defaultTerm(years, now);
    final year =
        years.where((year) => year.id == _yearId).firstOrNull ??
        years.where((year) => year.id == initial?.schoolYearId).firstOrNull ??
        years.where((year) => year.isActive).firstOrNull ??
        years.first;
    final terms = [...year.terms]
      ..sort((a, b) => a.termNumber.compareTo(b.termNumber));
    final picked =
        terms.where((term) => term.id == _termId).firstOrNull ??
        terms.where((term) => term.id == initial?.id).firstOrNull ??
        defaultTerm([year], now);
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    return IgnorePointer(
      ignoring: _saving,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'School year',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 360),
              child: DropdownButtonFormField<String>(
                key: ValueKey('school-year-${year.id}'),
                initialValue: year.id,
                isExpanded: true,
                dropdownColor: authPanel,
                decoration: InputDecoration(
                  filled: true,
                  fillColor: authPanel,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 14,
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(6),
                    borderSide: const BorderSide(color: authBorder),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(6),
                    borderSide: const BorderSide(color: authMint),
                  ),
                ),
                items: [
                  for (final year in years)
                    DropdownMenuItem(
                      value: year.id,
                      child: Text(
                        '${year.name}${year.isActive ? ' (Active)' : ''}',
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 13),
                      ),
                    ),
                ],
                onChanged: _saving
                    ? null
                    : (id) => setState(() {
                        _yearId = id;
                        _termId = null;
                        _error = null;
                      }),
              ),
            ),
          ),
          const SizedBox(height: 24),
          if (terms.isEmpty)
            const ZEmpty(
              icon: Icons.event_note_outlined,
              title: 'No terms in this school year',
              subtitle: 'Choose another school year, or ask the school office to add its terms.',
            )
          else
            LayoutBuilder(
              builder: (context, constraints) {
                final columns = constraints.maxWidth >= 780
                    ? 3
                    : constraints.maxWidth >= 540
                    ? 2
                    : 1;
                final width =
                    (constraints.maxWidth - (columns - 1) * 16) / columns;
                return Wrap(
                  spacing: 16,
                  runSpacing: 16,
                  children: [
                    for (final term in terms)
                      SizedBox(
                        width: width,
                        child: _TermCard(
                          term: term,
                          yearName: year.name,
                          selected: picked?.id == term.id,
                          status: termStatus(term, now),
                          reduceMotion: reduceMotion,
                          onTap: () => setState(() {
                            _yearId = year.id;
                            _termId = term.id;
                            _error = null;
                          }),
                        ),
                      ),
                  ],
                );
              },
            ),
          if (_error != null) ...[
            const SizedBox(height: 20),
            Semantics(
              liveRegion: true,
              child: Text(
                _error!,
                style: const TextStyle(color: Color(0xffff9f9f), fontSize: 13),
              ),
            ),
          ],
          const SizedBox(height: 28),
          Align(
            alignment: Alignment.centerRight,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 360),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: picked == null || _saving
                      ? null
                      : () => _continue(picked, year),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (_saving) ...[
                          const AuthSpinner(size: 16, color: authMuted),
                          const SizedBox(width: 10),
                        ],
                        Flexible(
                          child: Text(
                            _saving
                                ? 'Opening workspace…'
                                : 'Continue to workspace',
                            textAlign: TextAlign.center,
                          ),
                        ),
                        if (!_saving) ...[
                          const SizedBox(width: 10),
                          const Icon(Icons.arrow_forward, size: 16),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TermCard extends StatelessWidget {
  const _TermCard({
    required this.term,
    required this.yearName,
    required this.selected,
    required this.status,
    required this.reduceMotion,
    required this.onTap,
  });
  final Term term;
  final String yearName;
  final bool selected;
  final String? status;
  final bool reduceMotion;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final start = term.startDate;
    final end = term.endDate;
    // School dates use Philippine calendar dates, not the device's time zone.
    String date(DateTime value) =>
        DateFormat('MMM d, y')
            .format(value.toUtc().add(const Duration(hours: 8)));
    final range = start == null || end == null || end.isBefore(start)
        ? 'Dates not set'
        : '${date(start)} – ${date(end)}';
    return Semantics(
      selected: selected,
      inMutuallyExclusiveGroup: true,
      child: AnimatedContainer(
        duration: reduceMotion
            ? Duration.zero
            : const Duration(milliseconds: 160),
        decoration: BoxDecoration(
          color: authPanel.withValues(alpha: 0.92),
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Colors.white.withValues(alpha: selected ? 0.065 : 0.035),
              Colors.transparent,
            ],
          ),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? authMint : authBorder,
            width: selected ? 1.5 : 1,
          ),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: authMint.withValues(alpha: 0.1),
                    blurRadius: 0,
                    spreadRadius: 3,
                  ),
                ]
              : [],
        ),
        child: Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            key: ValueKey('term-${term.id}'),
            onTap: onTap,
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    alignment: WrapAlignment.spaceBetween,
                    spacing: 12,
                    runSpacing: 8,
                    children: [
                      Text(
                        'Term ${term.termNumber}',
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (status != null)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: (status == 'Ongoing' ? authMint : authMuted)
                                .withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            status!,
                            style: TextStyle(
                              color: status == 'Ongoing' ? authMint : authMuted,
                              fontSize: 11,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    yearName,
                    style: const TextStyle(color: authMuted, fontSize: 12),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    range,
                    style: const TextStyle(fontSize: 13, height: 1.5),
                  ),
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      Icon(
                        selected
                            ? Icons.radio_button_checked
                            : Icons.radio_button_off,
                        color: selected ? authMint : authMuted,
                        size: 16,
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          selected ? 'Selected' : 'Select this term',
                          style: TextStyle(
                            color: selected ? authMint : authMuted,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
