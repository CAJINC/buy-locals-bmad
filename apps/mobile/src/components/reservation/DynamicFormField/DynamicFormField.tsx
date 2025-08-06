import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import DocumentPicker from 'react-native-document-picker';
import { Picker } from '@react-native-picker/picker';
import { styles } from './styles';
import type { DynamicFormFieldProps, SelectOption } from './types';

export const DynamicFormField: React.FC<DynamicFormFieldProps> = ({
  config,
  value,
  onChange,
  error,
  theme = 'light',
  disabled = false,
  allFormData = {}
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Array<{ uri: string; name: string; type: string }>>([]);

  const handleDateChange = useCallback((event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      onChange(selectedDate.toISOString());
    }
  }, [onChange]);

  const handleFilePicker = useCallback(async () => {
    try {
      const results = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
        allowMultiSelection: config.fieldType === 'file' // Allow multiple for file, single for image
      });

      setSelectedFiles(results.map(result => ({
        uri: result.uri,
        name: result.name || 'Unknown file',
        type: result.type || 'application/octet-stream'
      })));

      onChange(results);
    } catch (error) {
      if (!DocumentPicker.isCancel(error)) {
        Alert.alert('Error', 'Failed to select file(s)');
      }
    }
  }, [config.fieldType, onChange]);

  const renderTextInput = () => (
    <TextInput
      style={[
        styles.textInput,
        theme === 'dark' && styles.textInputDark,
        error && styles.textInputError,
        disabled && styles.textInputDisabled
      ]}
      value={value as string || ''}
      onChangeText={onChange}
      placeholder={config.placeholder}
      placeholderTextColor={theme === 'dark' ? '#666666' : '#999999'}
      editable={!disabled}
      multiline={config.fieldType === 'textarea'}
      numberOfLines={config.fieldType === 'textarea' ? 4 : 1}
      keyboardType={getKeyboardType(config.fieldType)}
      autoCapitalize={config.fieldType === 'email' ? 'none' : 'sentences'}
      autoCorrect={config.fieldType !== 'email'}
      secureTextEntry={config.fieldType === 'password'}
    />
  );

  const renderSelect = () => {
    const selectedOption = config.options?.find(option => option.value === value);
    
    return (
      <>
        <TouchableOpacity
          style={[
            styles.selectButton,
            theme === 'dark' && styles.selectButtonDark,
            error && styles.selectButtonError,
            disabled && styles.selectButtonDisabled
          ]}
          onPress={() => !disabled && setShowPicker(true)}
        >
          <Text style={[
            styles.selectButtonText,
            theme === 'dark' && styles.selectButtonTextDark,
            !selectedOption && styles.selectPlaceholder
          ]}>
            {selectedOption?.label || config.placeholder || 'Select option'}
          </Text>
        </TouchableOpacity>

        <Modal
          visible={showPicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, theme === 'dark' && styles.modalContentDark]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, theme === 'dark' && styles.modalTitleDark]}>
                  {config.displayLabel}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowPicker(false)}
                  style={styles.modalCloseButton}
                >
                  <Text style={styles.modalCloseText}>Done</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={config.options}
                keyExtractor={(item) => item.value}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.optionItem,
                      item.value === value && styles.optionItemSelected,
                      theme === 'dark' && styles.optionItemDark,
                      item.disabled && styles.optionItemDisabled
                    ]}
                    onPress={() => {
                      if (!item.disabled) {
                        onChange(item.value);
                        setShowPicker(false);
                      }
                    }}
                    disabled={item.disabled}
                  >
                    <View style={styles.optionContent}>
                      <Text style={[
                        styles.optionLabel,
                        theme === 'dark' && styles.optionLabelDark,
                        item.disabled && styles.optionLabelDisabled
                      ]}>
                        {item.label}
                      </Text>
                      {item.price !== undefined && item.price > 0 && (
                        <Text style={[
                          styles.optionPrice,
                          theme === 'dark' && styles.optionPriceDark
                        ]}>
                          +${item.price.toFixed(2)}
                        </Text>
                      )}
                    </View>
                    {item.description && (
                      <Text style={[
                        styles.optionDescription,
                        theme === 'dark' && styles.optionDescriptionDark
                      ]}>
                        {item.description}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
                style={styles.optionsList}
              />
            </View>
          </View>
        </Modal>
      </>
    );
  };

  const renderMultiSelect = () => {
    const selectedValues = Array.isArray(value) ? value : [];
    const selectedOptions = config.options?.filter(option => 
      selectedValues.includes(option.value)
    ) || [];

    return (
      <>
        <TouchableOpacity
          style={[
            styles.selectButton,
            theme === 'dark' && styles.selectButtonDark,
            error && styles.selectButtonError,
            disabled && styles.selectButtonDisabled
          ]}
          onPress={() => !disabled && setShowPicker(true)}
        >
          <Text style={[
            styles.selectButtonText,
            theme === 'dark' && styles.selectButtonTextDark,
            selectedOptions.length === 0 && styles.selectPlaceholder
          ]}>
            {selectedOptions.length > 0 
              ? `${selectedOptions.length} selected`
              : config.placeholder || 'Select options'}
          </Text>
        </TouchableOpacity>

        <Modal
          visible={showPicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, theme === 'dark' && styles.modalContentDark]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, theme === 'dark' && styles.modalTitleDark]}>
                  {config.displayLabel}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowPicker(false)}
                  style={styles.modalCloseButton}
                >
                  <Text style={styles.modalCloseText}>Done</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={config.options}
                keyExtractor={(item) => item.value}
                renderItem={({ item }) => {
                  const isSelected = selectedValues.includes(item.value);
                  
                  return (
                    <TouchableOpacity
                      style={[
                        styles.optionItem,
                        isSelected && styles.optionItemSelected,
                        theme === 'dark' && styles.optionItemDark,
                        item.disabled && styles.optionItemDisabled
                      ]}
                      onPress={() => {
                        if (!item.disabled) {
                          const newValues = isSelected
                            ? selectedValues.filter(v => v !== item.value)
                            : [...selectedValues, item.value];
                          onChange(newValues);
                        }
                      }}
                      disabled={item.disabled}
                    >
                      <View style={styles.optionContent}>
                        <View style={styles.checkboxContainer}>
                          <View style={[
                            styles.checkbox,
                            isSelected && styles.checkboxChecked,
                            theme === 'dark' && styles.checkboxDark
                          ]}>
                            {isSelected && <Text style={styles.checkmark}>✓</Text>}
                          </View>
                          <Text style={[
                            styles.optionLabel,
                            theme === 'dark' && styles.optionLabelDark,
                            item.disabled && styles.optionLabelDisabled
                          ]}>
                            {item.label}
                          </Text>
                        </View>
                        {item.price !== undefined && item.price > 0 && (
                          <Text style={[
                            styles.optionPrice,
                            theme === 'dark' && styles.optionPriceDark
                          ]}>
                            +${item.price.toFixed(2)}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                }}
                style={styles.optionsList}
              />
            </View>
          </View>
        </Modal>
      </>
    );
  };

  const renderRadio = () => (
    <View style={styles.radioGroup}>
      {config.options?.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.radioOption,
            theme === 'dark' && styles.radioOptionDark,
            option.disabled && styles.radioOptionDisabled
          ]}
          onPress={() => !disabled && !option.disabled && onChange(option.value)}
          disabled={disabled || option.disabled}
        >
          <View style={styles.radioContainer}>
            <View style={[
              styles.radioButton,
              theme === 'dark' && styles.radioButtonDark
            ]}>
              {value === option.value && (
                <View style={styles.radioButtonSelected} />
              )}
            </View>
            <Text style={[
              styles.radioLabel,
              theme === 'dark' && styles.radioLabelDark,
              option.disabled && styles.radioLabelDisabled
            ]}>
              {option.label}
            </Text>
          </View>
          {option.price !== undefined && option.price > 0 && (
            <Text style={[
              styles.optionPrice,
              theme === 'dark' && styles.optionPriceDark
            ]}>
              +${option.price.toFixed(2)}
            </Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderCheckbox = () => {
    const isChecked = Boolean(value);
    
    return (
      <TouchableOpacity
        style={[
          styles.checkboxOption,
          theme === 'dark' && styles.checkboxOptionDark,
          disabled && styles.checkboxOptionDisabled
        ]}
        onPress={() => !disabled && onChange(!isChecked)}
        disabled={disabled}
      >
        <View style={[
          styles.checkbox,
          isChecked && styles.checkboxChecked,
          theme === 'dark' && styles.checkboxDark
        ]}>
          {isChecked && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={[
          styles.checkboxLabel,
          theme === 'dark' && styles.checkboxLabelDark,
          disabled && styles.checkboxLabelDisabled
        ]}>
          {config.displayLabel}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderNumber = () => (
    <TextInput
      style={[
        styles.textInput,
        theme === 'dark' && styles.textInputDark,
        error && styles.textInputError,
        disabled && styles.textInputDisabled
      ]}
      value={value ? String(value) : ''}
      onChangeText={(text) => {
        const numericValue = parseFloat(text);
        onChange(isNaN(numericValue) ? '' : numericValue);
      }}
      placeholder={config.placeholder}
      placeholderTextColor={theme === 'dark' ? '#666666' : '#999999'}
      keyboardType="numeric"
      editable={!disabled}
    />
  );

  const renderDateTimePicker = () => {
    const dateValue = value ? new Date(value as string) : new Date();
    const mode = config.fieldType === 'date' ? 'date' : 
                 config.fieldType === 'time' ? 'time' : 'datetime';
    
    return (
      <>
        <TouchableOpacity
          style={[
            styles.dateButton,
            theme === 'dark' && styles.dateButtonDark,
            error && styles.dateButtonError,
            disabled && styles.dateButtonDisabled
          ]}
          onPress={() => !disabled && setShowDatePicker(true)}
        >
          <Text style={[
            styles.dateButtonText,
            theme === 'dark' && styles.dateButtonTextDark,
            !value && styles.datePlaceholder
          ]}>
            {value ? formatDateValue(dateValue, config.fieldType) : config.placeholder || 'Select date/time'}
          </Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={dateValue}
            mode={mode as any}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}
      </>
    );
  };

  const renderFileUpload = () => (
    <View style={styles.fileUploadContainer}>
      <TouchableOpacity
        style={[
          styles.fileUploadButton,
          theme === 'dark' && styles.fileUploadButtonDark,
          disabled && styles.fileUploadButtonDisabled
        ]}
        onPress={handleFilePicker}
        disabled={disabled}
      >
        <Text style={[
          styles.fileUploadButtonText,
          theme === 'dark' && styles.fileUploadButtonTextDark
        ]}>
          {config.fieldType === 'image' ? 'Select Image' : 'Select File(s)'}
        </Text>
      </TouchableOpacity>

      {selectedFiles.length > 0 && (
        <View style={styles.selectedFiles}>
          {selectedFiles.map((file, index) => (
            <View key={index} style={[
              styles.selectedFile,
              theme === 'dark' && styles.selectedFileDark
            ]}>
              <Text style={[
                styles.selectedFileName,
                theme === 'dark' && styles.selectedFileNameDark
              ]}>
                {file.name}
              </Text>
              <TouchableOpacity
                style={styles.removeFileButton}
                onPress={() => {
                  const newFiles = selectedFiles.filter((_, i) => i !== index);
                  setSelectedFiles(newFiles);
                  onChange(newFiles);
                }}
              >
                <Text style={styles.removeFileText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderField = () => {
    switch (config.fieldType) {
      case 'text':
      case 'textarea':
      case 'email':
      case 'phone':
      case 'password':
        return renderTextInput();
      case 'select':
        return renderSelect();
      case 'multiselect':
        return renderMultiSelect();
      case 'radio':
        return renderRadio();
      case 'checkbox':
        return renderCheckbox();
      case 'number':
        return renderNumber();
      case 'date':
      case 'time':
      case 'datetime':
        return renderDateTimePicker();
      case 'file':
      case 'image':
        return renderFileUpload();
      default:
        return renderTextInput();
    }
  };

  return (
    <View style={[styles.container, disabled && styles.containerDisabled]}>
      {config.fieldType !== 'checkbox' && (
        <Text style={[
          styles.label,
          theme === 'dark' && styles.labelDark,
          config.required && styles.labelRequired,
          disabled && styles.labelDisabled
        ]}>
          {config.displayLabel}
          {config.required && <Text style={styles.requiredMark}> *</Text>}
        </Text>
      )}

      {config.helpText && (
        <Text style={[
          styles.helpText,
          theme === 'dark' && styles.helpTextDark
        ]}>
          {config.helpText}
        </Text>
      )}

      {renderField()}

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
};

// Helper functions
function getKeyboardType(fieldType: string) {
  switch (fieldType) {
    case 'email':
      return 'email-address';
    case 'phone':
      return 'phone-pad';
    case 'number':
      return 'numeric';
    default:
      return 'default';
  }
}

function formatDateValue(date: Date, fieldType: string): string {
  switch (fieldType) {
    case 'date':
      return date.toLocaleDateString();
    case 'time':
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    case 'datetime':
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    default:
      return date.toString();
  }
}