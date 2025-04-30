export const mockFetch = (mockResource, maxResults) => {
  return new Promise((resolve) => {
    const randomDelay = Math.floor(Math.random() * 1000);

    setTimeout(() => {
      maxResults = parseInt(maxResults, 10);
      const randomIndex = Math.floor(
        Math.random() * (mockResource.items.length - maxResults)
      );

      const items = mockResource.items.slice(
        randomIndex,
        randomIndex + maxResults
      );

      const mockResponse = {
        ...mockResource,
        items,
      };
      resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });
    }, randomDelay);
  });
};
