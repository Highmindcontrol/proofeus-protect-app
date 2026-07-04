module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "react" }]],
    // Depuis Reanimated 4 (Expo SDK 53+), le plugin worklets a été
    // extrait dans un package séparé react-native-worklets.
    plugins: ["react-native-worklets/plugin"],
  };
};
