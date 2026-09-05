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

  void _onRoleCategoryChanged(String category) {
    setState(() {
      _selectedRoleCategory = category;
      _errorMessage = null;

      // Default quick suggestions based on selected role
      if (category == 'staff') {
        _identifierController.text = 'adviser.santos@msat.edu.ph';
      } else if (category == 'student') {
        _identifierController.text = '109283746501';
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

  Future<void> _handleGoogleLogin() async {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: AppColors.surfaceElevated,
        content: Text(
          'Connecting to Google Auth for ${_getRoleLabel()}...',
          style: GoogleFonts.inter(color: AppColors.textPrimary),
        ),
      ),
    );
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
                  // 1. Top Brand Header
                  _buildHeader(),
                  const SizedBox(height: 24),

                  // 2. Role Cards Grid Selector (Matching web /login)
                  _buildRoleCardsGrid(),
                  const SizedBox(height: 20),

                  // 3. Login Form Card (Matching web LoginForm.tsx)
                  _buildLoginFormCard(),
                  const SizedBox(height: 20),

                  // 4. Footer Note
                  Text(
                    'Need an account? Contact your school administrator for access.',
                    style: GoogleFonts.inter(
                      color: AppColors.textMuted,
                      fontSize: 12,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),

                  // 5. Quick Test Account Presets (Subtle & clean)
                  _buildQuickPresets(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Header Component
  // ---------------------------------------------------------------------------
  Widget _buildHeader() {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.surfaceElevated,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.borderSubtle),
              ),
              child: const Icon(
                Icons.school,
                color: AppColors.primaryEmerald,
                size: 24,
              ),
            ),
            const SizedBox(width: 10),
            Text(
              'Zentra',
              style: GoogleFonts.inter(
                color: AppColors.textPrimary,
                fontSize: 26,
                fontWeight: FontWeight.bold,
                letterSpacing: -0.5,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 16,
              height: 1,
              color: AppColors.borderSubtle,
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Text(
                'Mati School of Arts and Trades',
                style: GoogleFonts.robotoMono(
                  color: AppColors.textMuted,
                  fontSize: 11,
                ),
              ),
            ),
            Container(
              width: 16,
              height: 1,
              color: AppColors.borderSubtle,
            ),
          ],
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Role Cards Grid Selector (Matching web /login)
  // ---------------------------------------------------------------------------
  Widget _buildRoleCardsGrid() {
    return Row(
      children: [
        _roleCardItem(
          category: 'student',
          label: 'Student',
          icon: Icons.school_outlined,
        ),
        const SizedBox(width: 8),
        _roleCardItem(
          category: 'staff',
          label: 'Staff',
          icon: Icons.badge_outlined,
        ),
        const SizedBox(width: 8),
        _roleCardItem(
          category: 'parent',
          label: 'Parent',
          icon: Icons.groups_outlined,
        ),
      ],
    );
  }

  Widget _roleCardItem({
    required String category,
    required String label,
    required IconData icon,
  }) {
    final isSelected = _selectedRoleCategory == category;

    return Expanded(
      child: GestureDetector(
        onTap: () => _onRoleCategoryChanged(category),
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
                size: 22,
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

  // ---------------------------------------------------------------------------
  // Login Form Card
  // ---------------------------------------------------------------------------
  Widget _buildLoginFormCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Form Title & Subtitle
          Text(
            _getFormTitle(),
            style: GoogleFonts.inter(
              color: AppColors.textPrimary,
              fontSize: 18,
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
          const SizedBox(height: 20),

          // Identifier Input Field
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

          // Password Input Field
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
                  'Forgot password?',
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

          // Primary Sign In Button
          SizedBox(
            width: double.infinity,
            height: 44,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _handleLogin,
              child: _isLoading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Color(0xFF0C1612),
                      ),
                    )
                  : Text(
                      'Sign in',
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
            ),
          ),

          const SizedBox(height: 16),

          // Divider (─── or ───)
          Row(
            children: [
              Expanded(child: Container(height: 1, color: AppColors.borderSubtle)),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text(
                  'or',
                  style: GoogleFonts.inter(
                    color: AppColors.textMuted,
                    fontSize: 12,
                  ),
                ),
              ),
              Expanded(child: Container(height: 1, color: AppColors.borderSubtle)),
            ],
          ),

          const SizedBox(height: 16),

          // Google Sign In Button (Matching web LoginForm.tsx)
          SizedBox(
            width: double.infinity,
            height: 44,
            child: OutlinedButton(
              onPressed: _handleGoogleLogin,
              style: OutlinedButton.styleFrom(
                backgroundColor: AppColors.surfaceDark,
                side: const BorderSide(color: AppColors.borderSubtle, width: 1),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(6),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const GoogleLogoIcon(size: 18),
                  const SizedBox(width: 10),
                  Text(
                    'Sign in with Google',
                    style: GoogleFonts.inter(
                      color: AppColors.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Quick Test Presets
  // ---------------------------------------------------------------------------
  Widget _buildQuickPresets() {
    return Column(
      children: [
        Text(
          'Quick Demo Presets:',
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
            _presetChip('Student', '109283746501', 'student'),
          ],
        ),
      ],
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
          label,
          style: GoogleFonts.robotoMono(
            color: AppColors.primaryEmerald,
            fontSize: 11,
          ),
        ),
      ),
    );
  }

  // Helper strings
  String _getFormTitle() {
    switch (_selectedRoleCategory) {
      case 'student':
        return 'Student sign in';
      case 'parent':
        return 'Parent sign in';
      case 'staff':
      default:
        return 'Staff sign in';
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
        return 'Parent Email';
      case 'staff':
      default:
        return 'School email';
    }
  }

  String _getIdentifierPlaceholder() {
    switch (_selectedRoleCategory) {
      case 'student':
        return '109283746501 or name@student.msat.edu.ph';
      case 'parent':
        return 'parent@example.com';
      case 'staff':
      default:
        return 'name@msat.edu';
    }
  }

  String _getRoleLabel() {
    switch (_selectedRoleCategory) {
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

// -----------------------------------------------------------------------------
// Authentic 4-Color Google Logo Icon Painter
// -----------------------------------------------------------------------------
class GoogleLogoIcon extends StatelessWidget {
  final double size;
  const GoogleLogoIcon({super.key, this.size = 18});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: const _GoogleLogoPainter(),
      ),
    );
  }
}

class _GoogleLogoPainter extends CustomPainter {
  const _GoogleLogoPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final double w = size.width;
    final double h = size.height;
    final double cx = w / 2;
    final double cy = h / 2;

    final Paint red = Paint()..color = const Color(0xFFEA4335)..style = PaintingStyle.fill;
    final Paint blue = Paint()..color = const Color(0xFF4285F4)..style = PaintingStyle.fill;
    final Paint yellow = Paint()..color = const Color(0xFFFBBC05)..style = PaintingStyle.fill;
    final Paint green = Paint()..color = const Color(0xFF34A853)..style = PaintingStyle.fill;

    // Blue Path (Right G Arm)
    final Path bluePath = Path()
      ..moveTo(w * 0.98, cy)
      ..cubicTo(w * 0.98, h * 0.42, w * 0.96, h * 0.35, w * 0.93, h * 0.29)
      ..lineTo(cx, cy)
      ..lineTo(cx, h * 0.58)
      ..lineTo(w * 0.76, h * 0.58)
      ..cubicTo(w * 0.74, h * 0.65, w * 0.70, h * 0.72, w * 0.64, h * 0.76)
      ..lineTo(w * 0.80, h * 0.88)
      ..cubicTo(w * 0.91, h * 0.78, w * 0.98, h * 0.64, w * 0.98, cy)
      ..close();
    canvas.drawPath(bluePath, blue);

    // Green Path (Bottom Curve)
    final Path greenPath = Path()
      ..moveTo(cx, h)
      ..cubicTo(w * 0.64, h, w * 0.75, h * 0.95, w * 0.80, h * 0.88)
      ..lineTo(w * 0.64, h * 0.76)
      ..cubicTo(w * 0.60, h * 0.79, w * 0.52, h * 0.81, cx, h * 0.81)
      ..cubicTo(w * 0.33, h * 0.81, w * 0.20, h * 0.67, w * 0.17, h * 0.56)
      ..lineTo(w * 0.02, h * 0.68)
      ..cubicTo(w * 0.11, h * 0.87, w * 0.29, h, cx, h)
      ..close();
    canvas.drawPath(greenPath, green);

    // Yellow Path (Left Edge Curve)
    final Path yellowPath = Path()
      ..moveTo(w * 0.17, h * 0.56)
      ..cubicTo(w * 0.15, h * 0.52, w * 0.14, h * 0.46, w * 0.14, cy)
      ..cubicTo(w * 0.14, h * 0.44, w * 0.15, h * 0.38, w * 0.17, h * 0.34)
      ..lineTo(w * 0.02, h * 0.22)
      ..cubicTo(0, h * 0.31, 0, h * 0.59, w * 0.02, h * 0.68)
      ..lineTo(w * 0.17, h * 0.56)
      ..close();
    canvas.drawPath(yellowPath, yellow);

    // Red Path (Top Curve)
    final Path redPath = Path()
      ..moveTo(cx, h * 0.19)
      ..cubicTo(w * 0.54, h * 0.19, w * 0.63, h * 0.23, w * 0.69, h * 0.28)
      ..lineTo(w * 0.84, h * 0.13)
      ..cubicTo(w * 0.74, h * 0.04, w * 0.62, 0, cx, 0)
      ..cubicTo(w * 0.29, 0, w * 0.11, h * 0.13, w * 0.02, h * 0.22)
      ..lineTo(w * 0.17, h * 0.34)
      ..cubicTo(w * 0.20, h * 0.23, w * 0.33, h * 0.19, cx, h * 0.19)
      ..close();
    canvas.drawPath(redPath, red);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
