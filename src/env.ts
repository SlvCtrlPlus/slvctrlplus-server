import { Value } from '@sinclair/typebox/value';
import { Static, Type } from '@sinclair/typebox';
import os from 'os';

const EnvSchema = Type.Object({
    PORT: Type.Number({ default: 1337, minimum: 1, maximum: 65535 }),
    HTTPS_PORT: Type.Number({ default: 1338, minimum: 1, maximum: 65535 }),
    SSL_CERT_FILE: Type.Optional(Type.String({ minimumLength: 1 })),
    SSL_KEY_FILE: Type.Optional(Type.String({ minimumLength: 1 })),
    ALLOWED_ORIGINS: Type.Optional(Type.String({ minimumLength: 1 })),
    DATA_PATH: Type.String({ default: `${os.homedir()}/.slvctrlplus`, minimumLength: 1 }),
});

type Env = Static<typeof EnvSchema>;

export const parseEnv = (env: NodeJS.ProcessEnv): Env => {
    const converted = Value.Default(EnvSchema, Value.Convert(EnvSchema, { ...env }));

    if (!Value.Check(EnvSchema, converted)) {
        const errors = [...Value.Errors(EnvSchema, converted)];
        throw new Error(`Invalid environment variables:\n${errors.map(e => `  ${e.path}: ${e.message}`).join('\n')}`);
    }

    const hasCertFile = converted.SSL_CERT_FILE !== undefined;
    const hasKeyFile = converted.SSL_KEY_FILE !== undefined;

    if (hasCertFile !== hasKeyFile) {
        throw new Error('Invalid environment variables:\n  /SSL_CERT_FILE and /SSL_KEY_FILE must be set together');
    }

    return Value.Decode(EnvSchema, converted);
};
