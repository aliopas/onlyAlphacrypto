import axios from 'axios';
import { getTopBoostedTokens } from '../src/services/dexscreener.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('DexScreener Service - getTopBoostedTokens', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should fetch token profiles and then fetch pairs to get symbols', async () => {
        // Mock the first axios.get call (token-profiles)
        mockedAxios.get.mockResolvedValueOnce({
            data: [
                { tokenAddress: 'addr1' },
                { tokenAddress: 'addr2' }
            ]
        });

        // Mock the second axios.get call (pairs for addresses)
        mockedAxios.get.mockResolvedValueOnce({
            data: {
                pairs: [
                    {
                        baseToken: {
                            address: 'addr1',
                            symbol: 'TOKEN1'
                        }
                    },
                    {
                        baseToken: {
                            address: 'addr2',
                            symbol: 'TOKEN2'
                        }
                    }
                ]
            }
        });

        const result = await getTopBoostedTokens();

        // Assertions
        expect(mockedAxios.get).toHaveBeenCalledTimes(2);
        expect(mockedAxios.get).toHaveBeenNthCalledWith(
            1,
            'https://api.dexscreener.com/token-profiles/latest/v1',
            { timeout: 10000 }
        );
        expect(mockedAxios.get).toHaveBeenNthCalledWith(
            2,
            'https://api.dexscreener.com/latest/dex/tokens/addr1,addr2',
            { timeout: 10000 }
        );

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ symbol: 'TOKEN1', address: 'addr1' });
        expect(result[1]).toEqual({ symbol: 'TOKEN2', address: 'addr2' });
    });

    it('should return an empty array if profiles fetch fails', async () => {
        mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));

        const result = await getTopBoostedTokens();

        expect(result).toEqual([]);
        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it('should return an empty array if no profiles are returned', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: [] });

        const result = await getTopBoostedTokens();

        expect(result).toEqual([]);
        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });
});
