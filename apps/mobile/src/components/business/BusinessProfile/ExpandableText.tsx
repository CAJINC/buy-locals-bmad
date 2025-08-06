import React, { useState, useMemo, useCallback } from 'react';
import { VStack, Text, Pressable } from 'native-base';
import { ExpandableTextProps } from './types';

export const ExpandableText: React.FC<ExpandableTextProps> = React.memo(
  ({
    text,
    maxLines = 3,
    showMoreText = 'Show More',
    showLessText = 'Show Less',
    fontSize = 'md',
    color = 'gray.600',
  }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Calculate if text needs to be truncated
    const { displayText, needsTruncation } = useMemo(() => {
      if (!text) return { displayText: '', needsTruncation: false };

      // Simple estimation: assume ~40 characters per line for mobile
      const estimatedLinesNeeded = Math.ceil(text.length / 40);
      const needsTruncation = estimatedLinesNeeded > maxLines;

      if (!needsTruncation || isExpanded) {
        return { displayText: text, needsTruncation };
      }

      // Truncate text to approximately maxLines worth of content
      const maxChars = maxLines * 40;
      const truncatedText =
        text.length > maxChars ? `${text.substring(0, maxChars).trim()}...` : text;

      return { displayText: truncatedText, needsTruncation };
    }, [text, maxLines, isExpanded]);

    const toggleExpanded = useCallback(() => {
      setIsExpanded(prev => !prev);
    }, []);

    if (!text) {
      return null;
    }

    return (
      <VStack space={2}>
        <Text
          fontSize={fontSize}
          color={color}
          lineHeight="md"
          onLayout={handleTextLayout}
          numberOfLines={isExpanded ? undefined : maxLines}
        >
          {displayText}
        </Text>

        {needsTruncation && (
          <Pressable onPress={toggleExpanded} _pressed={{ opacity: 0.6 }}>
            <Text fontSize="sm" color="blue.600" fontWeight="medium" alignSelf="flex-start">
              {isExpanded ? showLessText : showMoreText}
            </Text>
          </Pressable>
        )}
      </VStack>
    );
  }
);
