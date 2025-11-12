import { useEffect } from "react";
import { Button, Text, View } from "react-native";
import { io } from "socket.io-client";

const socket = io("http://YOUR_LOCAL_IP:4000"); // use LAN IP when testing on device/emulator

export default function App() {
  useEffect(() => {
    socket.on("connect", () => console.log("mobile connected", socket.id));
    socket.on("message:new", (msg) => console.log("new message", msg));
  }, []);

  return (
    <View style={{ padding: 24 }}>
      <Text>Messenger Mobile (Expo)</Text>
      <Button title="Login socket" onPress={() => socket.emit("auth:login", "user2", (res) => console.log(res))} />
      <Button title="Send" onPress={() => socket.emit("message:send", { to: "user1", content: "hi from mobile", senderId: "user2" }, (ack) => console.log(ack))} />
    </View>
  );
}
