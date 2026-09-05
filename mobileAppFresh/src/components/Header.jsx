import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Bell, ChevronDown } from "lucide-react-native";
import { getUser } from "../services/auth";

export default function Header({ onProfileClick, onNotification }) {

  const user = getUser();
  const letter = user?.name?.charAt(0)?.toUpperCase() || "S";

  return (
    <View style={styles.header}>

      {/* Brand */}
      <View style={styles.brand}>
        <Text style={styles.icon}>🍽️</Text>
        <Text style={styles.title}>CRES-SAAPAADU</Text>
      </View>

      {/* Right actions */}
      <View style={styles.actions}>

        <TouchableOpacity
          style={styles.notify}
          onPress={onNotification}
        >
          <Bell size={20} color="#475569" />
          <View style={styles.dot}/>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.profile}
          onPress={onProfileClick}
        >

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{letter}</Text>
          </View>

          <ChevronDown size={16} color="#64748b"/>

        </TouchableOpacity>

      </View>

    </View>
  );
}

const styles = StyleSheet.create({

  header:{
    height:64,
    paddingHorizontal:16,
    backgroundColor:"#fff",
    borderBottomWidth:1,
    borderBottomColor:"#eee",
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"space-between"
  },

  brand:{
    flexDirection:"row",
    alignItems:"center",
    gap:6
  },

  icon:{
    fontSize:20
  },

  title:{
    fontWeight:"700",
    fontSize:16,
    color:"#0f172a"
  },

  actions:{
    flexDirection:"row",
    alignItems:"center",
    gap:12
  },

  notify:{
    width:40,
    height:40,
    borderRadius:20,
    backgroundColor:"#f1f5f9",
    alignItems:"center",
    justifyContent:"center"
  },

  dot:{
    position:"absolute",
    top:8,
    right:10,
    width:8,
    height:8,
    borderRadius:4,
    backgroundColor:"#ef4444"
  },

  profile:{
    flexDirection:"row",
    alignItems:"center",
    gap:6
  },

  avatar:{
    width:36,
    height:36,
    borderRadius:18,
    backgroundColor:"#6366f1",
    alignItems:"center",
    justifyContent:"center"
  },

  avatarText:{
    color:"#fff",
    fontWeight:"700"
  }

});
