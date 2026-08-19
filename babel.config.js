module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // react-native-reanimated v4 utilise react-native-worklets — le plugin
    // doit rester le dernier de la liste.
    plugins: ["react-native-worklets/plugin"],
  };
};
