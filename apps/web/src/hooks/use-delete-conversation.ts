import type { ConversationId } from "@lab/wire";
import { useMutation } from "@tanstack/react-query";
import { useLabClient } from "@/hooks/use-lab-client";

export function useDeleteConversation(
  onDeleted?: (id: ConversationId) => void,
) {
  const client = useLabClient();

  return useMutation({
    networkMode: "always",
    retry: false,
    mutationFn: async (id: ConversationId) => {
      const result = await client.deleteConversation(id);

      if (!result.ok && result.error.code !== "not_found") {
        throw new Error(result.error.message);
      }
    },
    onSuccess: (_value, id) => onDeleted?.(id),
  });
}
