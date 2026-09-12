export declare const ENVIRONMENTS: {
    readonly DEVELOPMENT: "development";
    readonly TEST: "test";
    readonly PRODUCTION: "production";
};
export type Environment = (typeof ENVIRONMENTS)[keyof typeof ENVIRONMENTS];
export declare const DEFAULT_PORT = 3000;
export declare const DEFAULT_API_PREFIX = "/api/v1";
//# sourceMappingURL=constants.d.ts.map