import { authClient } from '@/lib/auth';
import { call, client } from '@/lib/client';
import { useColors } from '@/lib/theme';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link, Stack } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';

function SignOut() {
  const colors = useColors();

  return (
    <Pressable accessibilityRole='button' onPress={() => authClient.signOut()}>
      <Text style={{ color: colors.mutedForeground }}>Sign out</Text>
    </Pressable>
  );
}

export default function Chats() {
  const colors = useColors();

  const conversations = useInfiniteQuery({
    queryKey: ['conversations'],
    queryFn: ({ pageParam, signal }) =>
      call(
        client.conversations.$get(
          { query: { cursor: pageParam } },
          { init: { signal } }
        )
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: ({ next }) => next ?? undefined,
    select: ({ pages }) => pages.flatMap((page) => page.conversations),
  });

  return (
    <>
      <Stack.Screen options={{ headerRight: SignOut }} />
      <FlatList
        contentInsetAdjustmentBehavior='automatic'
        data={conversations.data}
        keyExtractor={({ id }) => String(id)}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            {conversations.error?.message ??
              (conversations.isPending ? '' : 'No chats yet')}
          </Text>
        }
        onEndReached={() => {
          if (conversations.hasNextPage && !conversations.isFetchingNextPage) {
            void conversations.fetchNextPage();
          }
        }}
        onRefresh={() => void conversations.refetch()}
        refreshing={conversations.isRefetching}
        renderItem={({ item }) => (
          <Link
            href={{ pathname: '/chats/[id]', params: { id: item.id } }}
            asChild
          >
            <Pressable
              style={[styles.row, { borderBottomColor: colors.border }]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.title,
                  {
                    color: colors.foreground,
                    fontWeight: item.unread ? '600' : '400',
                  },
                ]}
              >
                {item.title ?? 'New chat'}
              </Text>
            </Pressable>
          </Link>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  empty: {
    padding: 24,
    textAlign: 'center',
  },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  title: {
    fontSize: 16,
  },
});
