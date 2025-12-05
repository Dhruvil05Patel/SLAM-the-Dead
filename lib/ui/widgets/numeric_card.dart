import 'package:flutter/material.dart';

class NumericCard extends StatelessWidget {
  const NumericCard({super.key, required this.title, required this.value, this.unit});

  final String title;
  final String value;
  final String? unit;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.all(8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 4),
            Row(
              children: [
                Text(value, style: Theme.of(context).textTheme.headlineSmall),
                if (unit != null) ...[
                  const SizedBox(width: 4),
                  Text(unit!, style: Theme.of(context).textTheme.bodySmall),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

