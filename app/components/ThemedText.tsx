import React from 'react';
import { Text, TextProps } from 'react-native';

export const ThemedText: React.FC<TextProps> = ({ style, children, ...props }) => {
  return (
    <Text style={style} {...props}>
      {children}
    </Text>
  );
};

export default ThemedText;
