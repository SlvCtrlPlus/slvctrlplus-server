declare module 'eslint-plugin-sort-class-members' {
    import type { ESLint, Linter, Rule } from "eslint";

    const eslintPluginSortClassMembers: ESLint.Plugin & {
        rules: {
            "sort-class-members": Rule.RuleModule;
        };
        configs: {
            recommended: Linter.LegacyConfig;
            "flat/recommended": Linter.Config;
        };
    };

    export default eslintPluginSortClassMembers;
}
