import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../app/constants/app_colors.dart';
import '../../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  String _selectedRoleCategory = 'staff'; // 'student' | 'staff' | 'parent'
  final _identifierController = TextEditingController(text: 'adviser.santos@msat.edu.ph');
  final _passwordController = TextEditingController(text: 'password123');
  bool _obscurePassword = true;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _onCategoryChanged(String category) {
    setState(() {
      _selectedRoleCategory = category;
      _errorMessage = null;

      // Update default placeholder suggestions for quick testing
      if (category == 'staff') {
        _identifierController.text = 'adviser.santos@msat.edu.ph';
      } else if (category == 'student') {
        _identifierController.text = 'carlos.reyes@student.msat.edu.ph';
      } else if (category == 'parent') {
        _identifierController.text = 'parent.reyes@gmail.com';
      }
    });
  }

  Future<void> _handleLogin() async {
    final identifier = _identifierController.text.trim();
    final password = _passwordController.text;

    if (identifier.isEmpty || password.isEmpty) {
      setState(() {
        _errorMessage = 'Please enter both credentials and password.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      await ref.read(authProvider.notifier).login(
            identifier: identifier,
            password: password,
            roleCategory: _selectedRoleCategory,
          );
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // App Branding Header
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceElevated,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.borderSubtle),
                    ),
                    child: const Icon(
                      Icons.school_outlined,
                      color: AppColors.primaryEmerald,
                      size: 30,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Zentra Mobile',
                    style: GoogleFonts.inter(
                      color: AppColors.textPrimary,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Mati School of Arts and Trades',
                    style: GoogleFonts.robotoMono(
                      color: AppColors.textMuted,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Account Type Selection Cards (Matching frontend /login)
                  Row(
                    children: [
                      _accountTypeCard(
                        category: 'student',
                        label: 'Student',
                        icon: Icons.school,
                      ),
                      const SizedBox(width: 8),
                      _accountTypeCard(
                        category: 'staff',
                        label: 'Staff',
                        icon: Icons.badge_outlined,
                      ),
                      const SizedBox(width: 8),
                      _accountTypeCard(
                        category: 'parent',
                        label: 'Parent',
                        icon: Icons.family_restroom,
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Login Form Card
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceCard,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.borderSubtle),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _getFormTitle(),
                          style: GoogleFonts.inter(
                            color: AppColors.textPrimary,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _getFormSubtitle(),
                          style: GoogleFonts.inter(
                            color: AppColors.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 18),

                        // Identifier Input (Email or LRN)
                        Text(
                          _getIdentifierLabel(),
                          style: GoogleFonts.inter(
                            color: AppColors.textPrimary,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 6),
                        TextField(
                          controller: _identifierController,
                          keyboardType: TextInputType.emailAddress,
                          style: GoogleFonts.robotoMono(
                            color: AppColors.textPrimary,
                            fontSize: 14,
                          ),
                          decoration: InputDecoration(
                            hintText: _getIdentifierPlaceholder(),
                            prefixIcon: const Icon(Icons.person_outline, size: 18, color: AppColors.textMuted),
                          ),
                        ),
                        const SizedBox(height: 14),

                        // Password Input
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Password',
                              style: GoogleFonts.inter(
                                color: AppColors.textPrimary,
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            TextButton(
                              style: TextButton.styleFrom(
                                padding: EdgeInsets.zero,
                                minimumSize: Size.zero,
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              ),
                              onPressed: () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Contact your school administrator for password reset.'),
                                  ),
                                );
                              },
                              child: Text(
                                'Forgot?',
                                style: GoogleFonts.inter(
                                  color: AppColors.primaryEmerald,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        TextField(
                          controller: _passwordController,
                          obscureText: _obscurePassword,
                          style: GoogleFonts.robotoMono(
                            color: AppColors.textPrimary,
                            fontSize: 14,
                          ),
                          decoration: InputDecoration(
                            hintText: '••••••••',
                            prefixIcon: const Icon(Icons.lock_outline, size: 18, color: AppColors.textMuted),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscurePassword ? Icons.visibility_off : Icons.visibility,
                                size: 18,
                                color: AppColors.textMuted,
                              ),
                              onPressed: () {
                                setState(() {
                                  _obscurePassword = !_obscurePassword;
                                });
                              },
                            ),
                          ),
                        ),

                        // Error Banner
                        if (_errorMessage != null) ...[
                          const SizedBox(height: 14),
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: AppColors.riskHigh.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: AppColors.riskHigh.withOpacity(0.4)),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.error_outline, size: 16, color: AppColors.riskHigh),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    _errorMessage!,
                                    style: GoogleFonts.inter(
                                      color: AppColors.riskHigh,
                                      fontSize: 12,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],

                        const SizedBox(height: 20),

                        // Submit Button
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: _isLoading ? null : _handleLogin,
                            child: _isLoading
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Color(0xFF0C1612),
                                    ),
                                  )
                                : Text(
                                    'Sign in as ${categoryLabel(_selectedRoleCategory)}',
                                    style: GoogleFonts.inter(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14,
                                    ),
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Preset Quick Testing Bar (Subtle & clean)
                  Text(
                    'Quick Test Accounts:',
                    style: GoogleFonts.robotoMono(color: AppColors.textMuted, fontSize: 11),
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    alignment: WrapAlignment.center,
                    children: [
                      _presetChip('Adviser', 'adviser.santos@msat.edu.ph', 'staff'),
                      _presetChip('ADM Coord', 'adm.coordinator@msat.edu.ph', 'staff'),
                      _presetChip('Parent', 'parent.reyes@gmail.com', 'parent'),
                      _presetChip('Student', 'carlos.reyes@student.msat.edu.ph', 'student'),
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

  Widget _accountTypeCard({
    required String category,
    required String label,
    required IconData icon,
  }) {
    final isSelected = _selectedRoleCategory == category;

    return Expanded(
      child: GestureDetector(
        onTap: () => _onCategoryChanged(category),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.surfaceElevated : AppColors.surfaceCard,
            borderRadius: BorderRadius.circular(6),
            border: Border.all(
              color: isSelected ? AppColors.primaryEmerald : AppColors.borderSubtle,
              width: isSelected ? 1.5 : 1,
            ),
          ),
          child: Column(
            children: [
              Icon(
                icon,
                color: isSelected ? AppColors.primaryEmerald : AppColors.textMuted,
                size: 20,
              ),
              const SizedBox(height: 6),
              Text(
                label,
                style: GoogleFonts.inter(
                  color: isSelected ? AppColors.textPrimary : AppColors.textSecondary,
                  fontSize: 12,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _presetChip(String label, String email, String category) {
    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedRoleCategory = category;
          _identifierController.text = email;
          _passwordController.text = 'password123';
          _errorMessage = null;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: AppColors.surfaceElevated,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: AppColors.borderSubtle),
        ),
        child: Text(
          '$label',
          style: GoogleFonts.robotoMono(
            color: AppColors.primaryEmerald,
            fontSize: 11,
          ),
        ),
      ),
    );
  }

  String _getFormTitle() {
    switch (_selectedRoleCategory) {
      case 'student':
        return 'Student Sign In';
      case 'parent':
        return 'Parent / Guardian Sign In';
      case 'staff':
      default:
        return 'Staff Sign In';
    }
  }

  String _getFormSubtitle() {
    switch (_selectedRoleCategory) {
      case 'student':
        return 'Access your grades, attendance, and learner records.';
      case 'parent':
        return 'Follow your child\'s progress and school updates.';
      case 'staff':
      default:
        return 'For teachers, advisers, guidance, and school leadership.';
    }
  }

  String _getIdentifierLabel() {
    switch (_selectedRoleCategory) {
      case 'student':
        return 'Student LRN or Email';
      case 'parent':
        return 'Parent Email Address';
      case 'staff':
      default:
        return 'School Email Address';
    }
  }

  String _getIdentifierPlaceholder() {
    switch (_selectedRoleCategory) {
      case 'student':
        return '109283746501 or name@student.msat.edu.ph';
      case 'parent':
        return 'parent@gmail.com';
      case 'staff':
      default:
        return 'name@msat.edu.ph';
    }
  }

  String categoryLabel(String category) {
    switch (category) {
      case 'student':
        return 'Student';
      case 'parent':
        return 'Parent';
      case 'staff':
      default:
        return 'Staff';
    }
  }
}
