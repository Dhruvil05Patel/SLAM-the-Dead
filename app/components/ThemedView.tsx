import React from 'react';
import { View, ViewProps } from 'react-native';

const ThemedView: React.FC<ViewProps> = ({ style, children, ...props }) => {
  return (
    <View style={style} {...props}>
      {children}
    </View>
  );
};

export default ThemedView;
