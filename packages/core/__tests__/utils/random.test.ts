import { generateUUID, getRandomValues } from '../../src/utils/random';

const UUID_V4_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const globals = globalThis as Record<string, unknown>;
const originalCrypto = globals.crypto;

const setCrypto = (value: unknown) => {
    Object.defineProperty(globalThis, 'crypto', {
        value,
        configurable: true,
        writable: true
    });
};

const removeCrypto = () => {
    delete globals.crypto;
};

/** getRandomValues() stub which fills the holder with a constant byte. */
const fillWith = (byte: number) => (holder: Uint8Array) => holder.fill(byte);

describe('random utils', () => {
    afterEach(() => {
        setCrypto(originalCrypto);
        delete globals.msCrypto;
    });

    describe('getRandomValues()', () => {
        test('when crypto is available then it delegates to crypto', async () => {
            // Init
            const holder = new Uint8Array(16);
            const getRandomValuesSpy = jest.fn(fillWith(0x01));
            setCrypto({ getRandomValues: getRandomValuesSpy });

            // Run
            const values = getRandomValues(holder);

            // Assert
            expect(getRandomValuesSpy).toHaveBeenCalledWith(holder);
            expect(values).toEqual(new Uint8Array(16).fill(0x01));
        });

        test('when crypto is undefined then it falls back to msCrypto', async () => {
            // Init
            const getRandomValuesSpy = jest.fn(fillWith(0x02));
            removeCrypto();
            globals.msCrypto = { getRandomValues: getRandomValuesSpy };

            // Run
            const values = getRandomValues(new Uint8Array(16));

            // Assert
            expect(getRandomValuesSpy).toHaveBeenCalled();
            expect(values).toEqual(new Uint8Array(16).fill(0x02));
        });

        test('when no crypto library is available then it throws', async () => {
            // Init
            removeCrypto();

            // Run and Assert
            expect(() => getRandomValues(new Uint8Array(16))).toThrow(
                'No crypto library found.'
            );
        });

        test('when using the platform crypto then the holder is populated', async () => {
            // Run
            const values = getRandomValues(new Uint8Array(16));

            // Assert
            expect(values).toHaveLength(16);
            expect(values.some((byte) => byte !== 0)).toBe(true);
        });
    });

    describe('generateUUID()', () => {
        test('when crypto.randomUUID is available then it is used', async () => {
            // Init
            const uuid = '1b6a3d4e-8f2c-4a1b-9c3d-5e6f7a8b9c0d';
            const randomUUID = jest.fn(() => uuid);
            const getRandomValuesSpy = jest.fn(fillWith(0x00));
            setCrypto({ randomUUID, getRandomValues: getRandomValuesSpy });

            // Run
            const result = generateUUID();

            // Assert
            expect(result).toEqual(uuid);
            expect(randomUUID).toHaveBeenCalled();
            expect(getRandomValuesSpy).not.toHaveBeenCalled();
        });

        test('when crypto.randomUUID is unavailable then a v4 UUID is generated from random bytes', async () => {
            // Init
            setCrypto({ getRandomValues: jest.fn(fillWith(0xab)) });

            // Run
            const result = generateUUID();

            // Assert
            expect(result).toMatch(UUID_V4_REGEX);
            expect(result).toEqual('abababab-abab-4bab-abab-abababababab');
        });

        test('when generating from all-zero bytes then version and variant bits are set', async () => {
            // Init
            setCrypto({ getRandomValues: jest.fn(fillWith(0x00)) });

            // Run
            const result = generateUUID();

            // Assert -- leading zeroes are preserved and bits 6/8 are stamped
            expect(result).toEqual('00000000-0000-4000-8000-000000000000');
        });

        test('when generating from all-one bytes then version and variant bits are set', async () => {
            // Init
            setCrypto({ getRandomValues: jest.fn(fillWith(0xff)) });

            // Run
            const result = generateUUID();

            // Assert
            expect(result).toEqual('ffffffff-ffff-4fff-bfff-ffffffffffff');
        });

        test('when crypto is undefined then it generates a UUID using msCrypto', async () => {
            // Init
            removeCrypto();
            globals.msCrypto = { getRandomValues: jest.fn(fillWith(0x10)) };

            // Run
            const result = generateUUID();

            // Assert
            expect(result).toMatch(UUID_V4_REGEX);
        });

        test('when no crypto library is available then it throws', async () => {
            // Init
            removeCrypto();

            // Run and Assert
            expect(() => generateUUID()).toThrow('No crypto library found.');
        });

        test('when generated repeatedly then UUIDs are valid and unique', async () => {
            // Init
            const uuids = new Set<string>();

            // Run
            for (let i = 0; i < 1000; i++) {
                const uuid = generateUUID();
                expect(uuid).toMatch(UUID_V4_REGEX);
                uuids.add(uuid);
            }

            // Assert
            expect(uuids.size).toEqual(1000);
        });

        test('when the random byte fallback is used repeatedly then UUIDs are valid and unique', async () => {
            // Init
            const platformCrypto = originalCrypto as Crypto;
            setCrypto({
                getRandomValues: (holder: Uint8Array) =>
                    platformCrypto.getRandomValues(holder)
            });
            const uuids = new Set<string>();

            // Run
            for (let i = 0; i < 1000; i++) {
                const uuid = generateUUID();
                expect(uuid).toMatch(UUID_V4_REGEX);
                uuids.add(uuid);
            }

            // Assert
            expect(uuids.size).toEqual(1000);
        });
    });
});
