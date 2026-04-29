"use client";
import { useEffect, useState } from "react";
import { socket } from "../lib/socket";

export function useSocket() {
    const [isConnected, setIsConnected] = useState(false);
    const [socketId, setSocketId] = useState("");

    useEffect(() => {
        function onConnect() {
            setIsConnected(true);
            setSocketId(socket.id);
        }

        function onDisconnect() {
            setIsConnected(false);
            setSocketId("");
        }

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);

        // Only connect when the hook is actively used by a component
        socket.connect();

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.disconnect();
        };
    }, []);

    return { socket, isConnected, socketId };
}