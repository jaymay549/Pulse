import { useSearchParams } from "react-router-dom";
import { useCallback } from "react";
import AIChatBox from "@/components/admin/chat/AIChatBox";

const AIChatPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const chatId = searchParams.get("chat")
    ? Number(searchParams.get("chat"))
    : null;

  const handleChatIdChange = useCallback(
    (id: number | null) => {
      if (id) {
        setSearchParams({ chat: String(id) }, { replace: true });
      } else {
        setSearchParams({}, { replace: true });
      }
    },
    [setSearchParams]
  );

  return (
    <div className="h-[calc(100vh-4rem)]">
      <AIChatBox
        initialChatId={chatId}
        onChatIdChange={handleChatIdChange}
      />
    </div>
  );
};

export default AIChatPage;
