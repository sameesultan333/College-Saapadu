/**
 * Sum of (price * quantity) across order items, formatted to 2 decimals.
 */
export function totalAmount(items = []) {
  return items.reduce((s, i) => s + (i.price || 0) * i.quantity, 0).toFixed(2);
}

/**
 * Label + emoji for a walk-in guest's self-declared category (or a
 * registered account's role). Never assume "Student" -- a walk-in could
 * be a parent or staff member, which is the whole reason this field
 * exists instead of a hardcoded label.
 */
const CUSTOMER_CATEGORY_META = {
  STUDENT: { label: "Student", emoji: "🎓" },
  PARENT: { label: "Parent", emoji: "👪" },
  STAFF: { label: "Staff", emoji: "🧑‍💼" },
};

export function customerCategoryMeta(category) {
  return CUSTOMER_CATEGORY_META[String(category || "").toUpperCase()] || { label: "Customer", emoji: "👤" };
}
