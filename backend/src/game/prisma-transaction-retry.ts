export async function retryOnTransactionConflict<T>(operation: () => Promise<T>, maxAttempts: number = 3): Promise<T>
{
	if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1)
	{
		throw new Error("INVALID_RETRY_COUNT");
	}

	for (let attempt = 1; attempt <= maxAttempts; attempt++)
	{
		try
		{
			return await operation();
		}
		catch (error)
		{
			const isConflict = error !== null && typeof error === "object" && "code" in error &&
				(error.code === "P2034" ||
				(error.code === "P2010" && "meta" in error && error.meta !== null && typeof error.meta === "object" && "code" in error.meta &&
				(error.meta.code === "40001" || error.meta.code === "40P01")
			));

			// Don't retry other errors or retry forever
			if (!isConflict || attempt === maxAttempts)
			{
				throw error;
			}

			// Small delay before trying again
			await new Promise<void>(resolve => setTimeout(resolve, 10 * attempt));
		}
	}

	throw new Error("TRANSACTION_RETRY_FAILED");
}
