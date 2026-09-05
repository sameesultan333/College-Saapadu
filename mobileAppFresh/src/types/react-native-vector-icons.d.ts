declare module "react-native-vector-icons/Feather" {
  import type { ComponentType } from "react";

  const Feather: ComponentType<{
    name: string;
    color?: string;
    size?: number;
  }>;

  export default Feather;
}