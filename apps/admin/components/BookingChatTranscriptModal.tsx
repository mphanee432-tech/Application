"use client";

import ChatTranscriptModal from "./ChatTranscriptModal";

export default function BookingChatTranscriptModal(props: {
  bookingId: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  return <ChatTranscriptModal {...props} />;
}

