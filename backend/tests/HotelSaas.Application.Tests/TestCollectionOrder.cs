using Xunit;

// Disable parallel test execution across test collections to prevent database connection exhaustion
[assembly: CollectionBehavior(DisableTestParallelization = true, MaxParallelThreads = 1)]
