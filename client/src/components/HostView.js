"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import { useSpotify } from "../hooks/useSpotify";
import { useRoom } from "../hooks/useRoom";

export default function HostView({ roomId, socket }) {
    const { playTrack, pausePlayback, seekTrack, getPlayer, searchTracks } = useSpotify();
    const { members, currentTrack, isPlaying, myPositionMs } = useRoom();

    const [track