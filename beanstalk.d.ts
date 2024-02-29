export default class Beanstalk {
    /**
     * Connect to beanstalkd server and return the Beanstalk API object.
     * @param options Optional parameters
     * @param options.host Host to connect to ["localhost"]
     * @param options.port Port to connect to [11300]
     * @param options.parseYaml Function for parsing YAML responses
     * @param options.delay Inital delay in milliseconds between connection attempts [10]
     * @param options.maxDelay Maximum dealy between connection attempts [5000]
     * @param options.logger Optional logger function
     */
    static connect(options: object): Promise<Beanstalk>;

    constructor(parseYaml?: (yaml: string) => object, logger?: (str: string) => any);
    connect(host: string, port: number, delay: number, maxDelay: number): Promise<this>;

    /**
     * Send `quit` and drop connection.
     */
    disconnect(): Promise<void>;

    /**
     * Send `quit` command to the server. The server will close the connection.
     */
    quit(): Promise<void>;

    /**
     * Use the specified tube.
     * Reponds with the name of the tube being used.
     *
     * @param tube Tube name to use.
     */
    use(tube: string): Promise<string>;

    /**
     * Responds with the name of the tube currently being used by the client.
     */
    listTubeUsed(): Promise<string>;

    /**
     * Submit a job with the specified priority (smaller integers are higher priority),
     * delay in seconds, and allowed time-to-run in seconds.
     * The payload contains the job data the server will return to clients reserving jobs; 
     * it can be either a Buffer or a string.
     * No processing is done on the data. Responds with the ID of the newly-created job.
     * 
     * @param payload Job data
     * @param options.priority Job priority
     * @param options.delay Delay in seconds before the job becomes ready for reservation
     * @param options.ttr Time in seconds for the job to be deleted or released after it's been reserved
     */
    put(payload?: string | Buffer, options: {priority?: number, delay?: number, ttr?: number}): Promise<string>;

    /**
     * Peek at the data for the job at the top of the ready queue of the tube currently in use.
     * Responds with the job ID and payload of the next job, or 'NOT_FOUND' if there are no qualifying jobs in the tube.
     * The payload is a Buffer object.
     */
    peekReady(): Promise<[string, Buffer]>;

    /**
     * Peek at the data for the delayed job with the shortest delay in the tube currently in use.
     * Responds with the job ID and payload of the next job, or 'NOT_FOUND' in err if there are no qualifying jobs in the tube.
     * The payload is a Buffer object.
     */
    peekDelayed(): Promise<[string, Buffer]>;

    /**
     * Peek at the data for the next buried job in the tube currently in use.
     * Responds with the job ID and payload of the next job, or 'NOT_FOUND' in err if there are no qualifying jobs in the tube.
     * The payload is a Buffer object.
     */
    peekBuried(): Promise<[string, Buffer]>;

    /**
     * Watch the named tube.
     * Responds with the number of tubes currently watched by the client.
     *
     * @param tube The Tube name to watch
     */
    watch(tube: string): Promise<number>;

    /**
     * Ignore the named tube.
     * Responds with the number of tubes currently watched by the client.
     *
     * @param tube The Tube name to ignore
     */
    ignore(tube: string): Promise<number>;

    /**
     * Responds with an array containing the names of the tubes currently watched by the client.
     */
    listTubeWatched(): Promise<string[]>;

    /**
     * Reserve a job, waiting the specified number of seconds before timing out, 
     * or waiting forever if timeout value is not specified.
     * Throws Error with message "TIMED_OUT" if the specified time elapsed before the job is deleted.
     * Payload is a buffer.
     *
     * @param seconds Timeout in seconds
     */
    reserve(seconds?: number): Promise<[string, string | Buffer]>;

    /**
     * Reserve a particular job.
     * Throws Error with message "NOT_FOUND" if the job is not available for reservation.
     * Avalable in server version >= 1.12
     *
     * @param jobId ID of the job
     */
    reserveJob(jobId?: number | string): Promise<[string, string | Buffer]>;

    /**
     * Inform the server that the client is still processing a job, thus requesting more time to work on it.
     *
     * @param id The job ID to reset TTR on
     */
    touch(id: number | string): Promise<void>;

    /**
     * Delete the specified job. Responds with null if successful, a string error otherwise.
     * This is the only method not named identically to its beanstalkd counterpart, because delete is a reserved word in Javascript.
     *
     * @param id The job ID to delete
     */
    delete(id: number | string): Promise<void>;

    /**
     * Release the specified job and assign it the given priority and delay (in seconds).
     *
     * @param id The job ID to release
     * @param options.priority The new priority in seconds
     * @param options.delay The new delay in seconds
     */
    release(id: number | string, options: {priority?: number, delay?: number}): Promise<void>;

    /**
     * Bury the specified job and assign it the given priority. Responds with null if successful, 
     * a string error otherwise.
     *
     * @param id The job ID to bury
     * @param options.priority The new priority to assign
     */
    bury(id: number | string, options: {priority?: number}): Promise<void>;

    /**
     * Kick at most maxToKick delayed and buried jobs back into the active queue.
     * Responds with the number of jobs kicked.
     *
     * @param maxToKick Max number of job to kick and bury.
     */
    kick(maxToKick: number): Promise<number>;

    /**
     * Kick the specified job ID. Responds with NOT_FOUND if the job was not found.
     *
     * @param id The job ID to kick
     */
    kickJob(id: number | string): Promise<void>;

    /**
     * Peek at the data for the specified job.
     * Payload is a Buffer object.
     *
     * @param id The job ID to peek
     */
    peek(id: number | string): Promise<Buffer>;

    /**
     * Pause the named tube for the given number of seconds.
     * No new jobs may be reserved from the tube while it is paused.
     *
     * @param tube The name of the tube to pause
     * @param delay The pause duration (in seconds)
     */
    pauseTube(tube: string, delay: number): Promise<void>;

    /**
     * Request statistics for the beanstalkd server.
     * Returns object containing information about the server.
     */
    stats(): Promise<object | string>;

    /**
     * Request statistics for the specified tube.
     * Returns object containing information about the tube if YAML parser was passed to connect,
     * otherwise returns YAML document as a Buffer.
     *
     * @param tube The name of the Tube to request stats for
     */
    statsTube(tube: string): Promise<object | Buffer>;

    /**
     * Request statistics for the specified job.
     * Returns object containing information about the job if YAML parser was passed to connect,
     * otherwise returns YAML document as a Buffer.
     *
     * @param id The job ID to request stats for
     */
    statsJob(id: number | string): Promise<object | Buffer>;

    /**
     * List all the existing tubes. Returns an array of tube names if YAML parser was passed to connect,
     * otherwise returns YAML document as a Buffer.
     */
    listTubes(): Promise<string[] | Buffer>;
}
