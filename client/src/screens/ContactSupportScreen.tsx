import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';

const ContactSupportScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return false;
    }
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return false;
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }
    if (!subject.trim()) {
      Alert.alert('Error', 'Please enter a subject');
      return false;
    }
    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    
    // Construct email URL with all fields
    const emailSubject = `Support Request: ${subject}`;
    const emailBody = `
Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}
    `;
    
    const mailtoUrl = `mailto:theedevkit@gmail.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    
    // Open email client
    Linking.canOpenURL(mailtoUrl)
      .then(supported => {
        if (supported) {
          return Linking.openURL(mailtoUrl);
        } else {
          Alert.alert(
            'Error',
            'Email app is not available on this device. Please send an email manually to theedevkit@gmail.com'
          );
        }
      })
      .catch(error => {
        console.error('Error opening email client:', error);
        Alert.alert('Error', 'Could not open email client. Please try again later.');
      })
      .finally(() => {
        setIsSubmitting(false);
        Alert.alert(
          'Message Sent',
          'Thank you for contacting us. Our support team will get back to you via email within 24-48 hours.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      });
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader 
        showBackButton 
        onBackPress={() => navigation.goBack()} 
        showProfile={false}
        headerTitle="Contact Support"
      />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerContainer}>
          <Ionicons name="headset" size={48} color={theme.colors.primary} />
          <Text style={styles.title}>Contact Support</Text>
          <Text style={styles.subtitle}>
            Have a question or need assistance? Our support team is here to help.
          </Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={theme.colors.textLight}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Your email address"
              placeholderTextColor={theme.colors.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Subject</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="What is this regarding?"
              placeholderTextColor={theme.colors.textLight}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Message</Text>
            <TextInput
              style={[styles.input, styles.messageInput]}
              value={message}
              onChangeText={setMessage}
              placeholder="Please describe your issue or question in detail"
              placeholderTextColor={theme.colors.textLight}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={theme.colors.white} size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Send Message</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.contactInfoContainer}>
          <Text style={styles.contactInfoTitle}>Other Ways to Reach Us</Text>
          
          <View style={styles.contactMethod}>
            <Ionicons name="mail-outline" size={24} color={theme.colors.primary} style={styles.contactIcon} />
            <View>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactValue}>theedevkit@gmail.com</Text>
            </View>
          </View>
          
          <View style={styles.contactMethod}>
            <Ionicons name="call-outline" size={24} color={theme.colors.primary} style={styles.contactIcon} />
            <View>
              <Text style={styles.contactLabel}>Phone</Text>
              <Text style={styles.contactValue}>09165913121</Text>
              <Text style={styles.contactHours}>Mon-Fri, 9am-5pm PHT</Text>
            </View>
          </View>

          <View style={styles.contactMethod}>
            <Ionicons name="location-outline" size={24} color={theme.colors.primary} style={styles.contactIcon} />
            <View>
              <Text style={styles.contactLabel}>Address</Text>
              <Text style={styles.contactValue}>Mati City, Davao Oriental, PH</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
  formContainer: {
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.text,
  },
  messageInput: {
    height: 120,
    paddingTop: 12,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  contactInfoContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  contactInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 16,
  },
  contactMethod: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  contactIcon: {
    marginRight: 16,
    marginTop: 2,
  },
  contactLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  contactValue: {
    fontSize: 14,
    color: theme.colors.text,
  },
  contactHours: {
    fontSize: 12,
    color: theme.colors.textLight,
    marginTop: 2,
  },
});

export default ContactSupportScreen; 