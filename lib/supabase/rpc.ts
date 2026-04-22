import type { PostgrestError } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type RpcFunctionRegistry = Database["public"]["Functions"];
type TypedRpcFunctionName = keyof RpcFunctionRegistry & string;

export type RpcFunctionName = [TypedRpcFunctionName] extends [never] ? string : TypedRpcFunctionName;

type RpcFallbackArgs = Record<string, unknown>;

export type RpcArgs<TFunctionName extends RpcFunctionName> = TFunctionName extends TypedRpcFunctionName
  ? RpcFunctionRegistry[TFunctionName]["Args"]
  : RpcFallbackArgs;

export type RpcReturn<TFunctionName extends RpcFunctionName, TFallback = unknown> =
  TFunctionName extends TypedRpcFunctionName ? RpcFunctionRegistry[TFunctionName]["Returns"] : TFallback;

type SupabaseRpcOptions = Parameters<(typeof supabaseServer)["rpc"]>[2];

export interface RpcMappedError {
  status: number;
  message: string;
  code: string | null;
  details: string | null;
  hint: string | null;
}

export type RpcCallResult<TData> =
  | { data: TData; error: null }
  | { data: null; error: RpcMappedError };

const RPC_ERROR_STATUS_MAP: Record<string, number> = {
  "22P02": 400,
  "22023": 400,
  "23502": 400,
  "23503": 400,
  "23505": 409,
  "23514": 400,
  "42501": 403,
  P0001: 400,
  PGRST202: 404,
};

function resolveRpcStatus(code: string | null): number {
  if (!code) {
    return 500;
  }

  return RPC_ERROR_STATUS_MAP[code] ?? 500;
}

export function mapRpcError(error: PostgrestError): RpcMappedError {
  return {
    status: resolveRpcStatus(error.code),
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  };
}

type RawRpcResponse = {
  data: unknown;
  error: PostgrestError | null;
};

type RpcInvoker = (
  functionName: string,
  args?: Record<string, unknown>,
  options?: SupabaseRpcOptions,
) => PromiseLike<RawRpcResponse>;

type LooseRpcClient = {
  rpc: RpcInvoker;
};

const rpcClient = supabaseServer as unknown as LooseRpcClient;

const rpcInvoker: RpcInvoker = (functionName, args, options) => rpcClient.rpc(functionName, args, options);

function normalizeRpcArgs<TFunctionName extends RpcFunctionName>(
  args: RpcArgs<TFunctionName> | undefined,
): Record<string, unknown> | undefined {
  if (args === undefined) {
    return undefined;
  }

  return args as Record<string, unknown>;
}

export async function callServerRpc<TFunctionName extends RpcFunctionName>(
  functionName: TFunctionName,
  args?: RpcArgs<TFunctionName>,
  options?: SupabaseRpcOptions,
): Promise<RpcCallResult<RpcReturn<TFunctionName>>> {
  const { data, error } = await rpcInvoker(functionName, normalizeRpcArgs(args), options);

  if (error) {
    return { data: null, error: mapRpcError(error) };
  }

  return { data: data as RpcReturn<TFunctionName>, error: null };
}
