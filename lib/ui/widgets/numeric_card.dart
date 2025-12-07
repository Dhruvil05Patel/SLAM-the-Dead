import 'package:flutter/material.dart';

class NumericCard extends StatelessWidget {
  const NumericCard({
    super.key, 
    required this.title, 
    required this.value, 
    this.unit,
    this.warning,
  });

  final String title;
  final String value;
  final String? unit;
  final String? warning;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isWarning = warning != null;
    
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      elevation: 2,
      color: isWarning ? theme.colorScheme.errorContainer : null,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  title.toUpperCase(),
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: isWarning 
                        ? theme.colorScheme.onErrorContainer 
                        : theme.textTheme.labelSmall?.color?.withOpacity(0.7),
                    fontWeight: FontWeight.w500,
                    letterSpacing: 0.5,
                  ),
                ),
                if (isWarning)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.error,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      warning!,
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: theme.colorScheme.onError,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  value,
                  style: theme.textTheme.titleLarge?.copyWith(
                    color: isWarning 
                        ? theme.colorScheme.onErrorContainer 
                        : theme.textTheme.titleLarge?.color,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (unit != null) ...[
                  const SizedBox(width: 4),
                  Text(
                    unit!,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: isWarning 
                          ? theme.colorScheme.onErrorContainer.withOpacity(0.7)
                          : theme.textTheme.bodySmall?.color,
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

