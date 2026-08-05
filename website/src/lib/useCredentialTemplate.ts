'use client';

// Loads the active credential design for a kind.
//
// Falls back to the built-in default when the table is absent or empty — which
// is the state of every deployment until 002_superadmin.sql has been run — so
// the Certificate Generator keeps working rather than rendering a blank page
// while the migration is pending.

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import {
  defaultDesign,
  withDefaults,
  type CredentialDesign,
  type CredentialKind,
} from './credentialTemplate';

export interface ActiveTemplate {
  design: CredentialDesign;
  version: number;
  name: string;
  /** True while the built-in default is standing in for a stored row. */
  isFallback: boolean;
  loading: boolean;
}

export function useCredentialTemplate(kind: CredentialKind): ActiveTemplate {
  const [state, setState] = useState<ActiveTemplate>({
    design: defaultDesign(kind),
    version: 0,
    name: 'Built-in default',
    isFallback: true,
    loading: true,
  });

  useEffect(() => {
    let live = true;
    (async () => {
      const { data, error } = await supabase
        .from('credential_templates')
        .select('design, version, name')
        .eq('kind', kind)
        .eq('is_active', true)
        .maybeSingle();

      if (!live) return;
      if (error || !data) {
        setState((s) => ({ ...s, loading: false }));
        return;
      }
      setState({
        design: withDefaults(kind, data.design as Partial<CredentialDesign>),
        version: data.version as number,
        name: data.name as string,
        isFallback: false,
        loading: false,
      });
    })();
    return () => { live = false; };
  }, [kind]);

  return state;
}
