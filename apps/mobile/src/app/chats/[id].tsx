import { call, client } from '@/lib/client';
import { messages } from '@/lib/messages';
import { useColors } from '@/lib/theme';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const colors = useColors();

  const summary = useQuery({
    queryKey: ['conversations', id],
    queryFn: ({ signal }) =>
      call(
        client.conversations[':id'].$get(
          { param: { id } },
          { init: { signal } }
        )
      ),
  });

  const transcript = useQuery({
    queryKey: ['conversations', id, 'entries'],
    queryFn: ({ signal }) =>
      call(
        client.conversations[':id'].entries.$get(
          { param: { id }, query: { limit: '100', order: 'descending' } },
          { init: { signal } }
        )
      ),
    select: ({ items }) => messages(items),
  });

  return (
    <>
      <Stack.Screen options={{ title: summary.data?.title ?? 'New chat' }} />
      <FlatList
        contentContainerStyle={styles.list}
        data={transcript.data}
        inverted
        keyExtractor={(message) => String(message.id)}
        ListEmptyComponent={
          <Text style={{ color: colors.mutedForeground }}>
            {transcript.error?.message}
          </Text>
        }
        renderItem={({ item }) => (
          <View
            style={
              item.role === 'user'
                ? [styles.user, { backgroundColor: colors.muted }]
                : undefined
            }
          >
            <Text
              selectable
              style={[styles.text, { color: colors.foreground }]}
            >
              {item.text}
            </Text>
          </View>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 16,
    padding: 16,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
  },
  user: {
    alignSelf: 'flex-end',
    borderRadius: 16,
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
});
