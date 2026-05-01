import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import React from 'react';
import { theme } from '../constants/theme';

const Button = ({
  buttonStyle,
  textStyle,
  title = '',
  onPress = () => {},
  loading = false,
  disabled = false,
  hasShadow = true,
}) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        hasShadow && styles.shadowStyle,
        (disabled || loading) && styles.disabled,
        buttonStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text style={[styles.text, textStyle]}>{title}</Text>
      )}
    </Pressable>
  )
}

export default Button

const styles = StyleSheet.create({
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: 'white',
    fontWeight: theme.fonts.semibold,
    fontSize: 16,
  },
  disabled: {
    opacity: 0.6,
  },
  shadowStyle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
});