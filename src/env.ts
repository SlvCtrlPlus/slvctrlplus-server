import { Value } from '@sinclair/typebox/value';
import { Static, Type } from '@sinclair/typebox';

const EnvSchema = Type.Object({
    PORT: Type.Number({ default: 1337, minimum: 1, maximum: 65535 }),
    HTTPS_PORT: Type.Number({ default: 1338, minimum: 1, maximum: 65535 }),
    SSL_CERT_FILE: Type.Optional(Type.String()),
    SSL_KEY_FILE: Type.Optional(Type.String()),
    ALLOWED_ORIGINS: Type.Optional(Type.String()),
});

type Env = Static<typeof EnvSchema>;

export const parseEnv = (env: NodeJS.ProcessEnv): Env => {
    const converted = Value.Convert(EnvSchema, { ...env });

    if (!Value.Check(EnvSchema, converted)) {
        const errors = [...Value.Errors(EnvSchema, converted)];
        throw new Error(`Invalid environment variables:\n${errors.map(e => `  ${e.path}: ${e.message}`).join('\n')}`);
    }

    return Value.Decode(EnvSchema, converted);
};
