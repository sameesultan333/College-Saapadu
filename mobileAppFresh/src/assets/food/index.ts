/**
 * Local food image registry.
 *
 * React Native's packager needs `require("./relative/path.png")` calls it
 * can statically see at build time -- it cannot resolve a dynamically
 * built string path. So every local food image gets registered here once,
 * and the rest of the app looks it up by key through FoodImage (see
 * ../../components/food/FoodImage.tsx) instead of requiring paths itself.
 *
 * LocalFoodImageKey is the full set of slide/photo slots the app knows
 * about (used by FoodImageCarousel's 10 slides) -- kept separate from
 * `localFoodImages`'s actual keys so the carousel and FoodImage compile
 * cleanly before any real photo exists. A key with no matching `require`
 * below just renders FoodImage's placeholder tile.
 *
 * To add a new local food photo:
 *   1. Drop the file in src/assets/food/<name>/<name>.jpg
 *   2. Add one line below: <name>: require("./<name>/<name>.jpg")
 *   3. Reference it as <FoodImage source={{ local: "<name>" }} .../>
 *
 * Nothing else in the app needs to change -- when the same items later
 * move to remote/CDN image_url values instead, FoodImage's remote branch
 * already handles that without a screen-level change.
 */
export type LocalFoodImageKey =
  | "idly" | "dosa" | "vada" | "samosa" | "biryani"
  | "meals" | "parotta" | "coffee" | "juice" | "sweet";

export const localFoodImages: Partial<Record<LocalFoodImageKey, ReturnType<typeof require>>> = {
  // idly: require("./idly/idly.jpg"),
  // dosa: require("./dosa/dosa.jpg"),
  // vada: require("./vada/vada.jpg"),
  // samosa: require("./samosa/samosa.jpg"),
  // biryani: require("./biryani/biryani.jpg"),
  // meals: require("./meals/meals.jpg"),
  // parotta: require("./parotta/parotta.jpg"),
  // coffee: require("./coffee/coffee.jpg"),
  // juice: require("./juice/juice.jpg"),
  // sweet: require("./sweet/sweet.jpg"),
};
