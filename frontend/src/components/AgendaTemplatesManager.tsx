import React, { useEffect, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Calendar, Trash2, Edit2, Layers, Copy } from 'lucide-react';
import {
	Form,
	FormField,
	FormItem,
	FormLabel,
	FormControl,
	FormMessage
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Zod schema para una plantilla de agenda
const timeSlotSchema = z.object({
	start: z.string().regex(/^\d{2}:\d{2}$/,'Formato HH:MM'),
	end: z.string().regex(/^\d{2}:\d{2}$/,'Formato HH:MM'),
	capacity: z.number().min(1).max(50).default(1)
});

const templateSchema = z.object({
	name: z.string().min(2,'Nombre muy corto').max(100),
	description: z.string().optional(),
	doctor_id: z.string().optional().or(z.literal('')).transform(v=> v? Number(v): undefined),
	specialty_id: z.string().optional().or(z.literal('')).transform(v=> v? Number(v): undefined),
	location_id: z.string().optional().or(z.literal('')).transform(v=> v? Number(v): undefined),
	days_of_week: z.array(z.number().min(1).max(7)).nonempty(),
	duration_minutes: z.coerce.number().min(15).max(240).default(30),
	break_between_slots: z.coerce.number().min(0).max(60).default(0),
	active: z.boolean().default(true),
	time_slots: z.array(timeSlotSchema).nonempty('Debe agregar al menos un horario')
});

type TemplateForm = z.infer<typeof templateSchema>;

const bulkSchema = z.object({
	template_id: z.number(),
	start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'YYYY-MM-DD'),
	end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'YYYY-MM-DD'),
	exclude_holidays: z.boolean().default(true),
	skip_existing: z.boolean().default(true)
});

type BulkForm = z.infer<typeof bulkSchema>;

interface AgendaTemplate {
	id: number;
	name: string;
	description?: string;
	doctor_id?: number; specialty_id?: number; location_id?: number;
	doctor_name?: string; specialty_name?: string; location_name?: string;
	days_of_week: string; // JSON stored
	time_slots: string; // JSON stored
	duration_minutes: number;
	break_between_slots: number;
	active: number | boolean;
	created_at?: string;
}

const DAYS: {value:number; label:string}[] = [
	{value:1,label:'Lun'}, {value:2,label:'Mar'}, {value:3,label:'Mié'}, {value:4,label:'Jue'}, {value:5,label:'Vie'}, {value:6,label:'Sáb'}, {value:7,label:'Dom'}
];

export default function AgendaTemplatesManager(){
	const [templates,setTemplates] = useState<AgendaTemplate[]>([]);
	const [loading,setLoading] = useState(false);
	const [openForm,setOpenForm] = useState(false);
	const [editId,setEditId] = useState<number|null>(null);
	const [openBulk,setOpenBulk] = useState(false);
	const [bulkTemplate,setBulkTemplate] = useState<AgendaTemplate|null>(null);
	const [doctors,setDoctors] = useState<any[]>([]);
	const [specialties,setSpecialties] = useState<any[]>([]);
	const [locations,setLocations] = useState<any[]>([]);

	const form = useForm<TemplateForm>({
		resolver: zodResolver(templateSchema),
		defaultValues:{
			name:'', description:'', doctor_id: undefined, specialty_id: undefined, location_id: undefined,
			days_of_week:[1,2,3,4,5], duration_minutes:30, break_between_slots:0, active:true,
			time_slots:[{start:'08:00', end:'12:00', capacity:4}]
		}
	});

	const bulkForm = useForm<BulkForm>({
		resolver: zodResolver(bulkSchema),
		defaultValues:{ template_id:0, start_date:'', end_date:'', exclude_holidays:true }
	});

	const loadRefs = async () => {
		try {
			const [d,s,l] = await Promise.all([
				api.getDoctors().catch(()=>[]),
				api.getSpecialties().catch(()=>[]),
				api.getLocations().catch(()=>[])
			]);
			setDoctors(d||[]); setSpecialties(s||[]); setLocations(l||[]);
		} catch(e){ /* ignore */ }
	};

	const loadTemplates = async () => {
		setLoading(true);
		try {
			const res = await api.getAgendaTemplates();
			setTemplates(res.data||[]);
		} catch(e){
			console.error(e); toast.error('Error cargando plantillas');
		} finally { setLoading(false);} }

	useEffect(()=>{ loadTemplates(); loadRefs(); },[]);

	const handleEdit = (tpl: AgendaTemplate) => {
		setEditId(tpl.id);
		form.reset({
			name: tpl.name,
			description: tpl.description || '',
			doctor_id: tpl.doctor_id,
			specialty_id: tpl.specialty_id,
			location_id: tpl.location_id,
			days_of_week: JSON.parse(tpl.days_of_week),
			duration_minutes: tpl.duration_minutes,
			break_between_slots: tpl.break_between_slots,
			active: !!tpl.active,
			time_slots: JSON.parse(tpl.time_slots)
		});
		setOpenForm(true);
	};

	const onSubmit = async (values: TemplateForm) => {
		try {
			const payload = {
				...values,
				days_of_week: JSON.stringify(values.days_of_week),
				time_slots: JSON.stringify(values.time_slots)
			};
			if(editId){
				await api.updateAgendaTemplate(editId, payload);
				toast.success('Plantilla actualizada');
			} else {
				await api.createAgendaTemplate(payload);
				toast.success('Plantilla creada');
			}
			setOpenForm(false); setEditId(null); form.reset(); loadTemplates();
		} catch(e:any){ toast.error(e.message||'Error guardando'); }
	};

	const handleDelete = async (tpl: AgendaTemplate) => {
		if(!confirm('¿Eliminar plantilla?')) return;
		try { await api.deleteAgendaTemplate(tpl.id); toast.success('Eliminada'); loadTemplates(); } catch(e:any){ toast.error(e.message||'Error'); }
	};

	const addTimeSlot = () => {
		const ts = form.getValues('time_slots');
		form.setValue('time_slots',[...ts,{start:'14:00', end:'18:00', capacity:4}]);
	};

	const removeTimeSlot = (idx:number) => {
		const ts = form.getValues('time_slots');
		if(ts.length===1) return; // keep at least one
		form.setValue('time_slots', ts.filter((_,i)=> i!==idx));
	};

	const toggleDay = (day:number) => {
		const current = form.getValues('days_of_week');
		if(current.includes(day)) form.setValue('days_of_week', current.filter(d=> d!==day));
		else form.setValue('days_of_week', [...current, day].sort());
	};

		const openBulkDialog = (tpl: AgendaTemplate) => {
		setBulkTemplate(tpl);
		bulkForm.reset({ template_id: tpl.id, start_date:'', end_date:'', exclude_holidays:true });
		setOpenBulk(true);
	};

		const duplicateTemplate = async (tpl: AgendaTemplate) => {
				try {
					await api.duplicateAgendaTemplate(tpl.id);
					toast.success('Plantilla duplicada');
					loadTemplates();
				} catch(e:any){ toast.error(e.message||'Error duplicando'); }
		};

		const submitBulk = async (data: BulkForm) => {
		try {
				const resp = await api.generateFromAgendaTemplate(data as any);
				const gen = (resp?.data?.generated_count) || 0;
				const skipped = (resp?.data?.skipped_conflicts) || 0;
				toast.success(`Generadas ${gen}. Omitidas ${skipped}`);
			setOpenBulk(false);
		} catch(e:any){ toast.error(e.message||'Error generando'); }
	};

	const dayBadges = (tpl: AgendaTemplate) => {
		const days: number[] = JSON.parse(tpl.days_of_week);
		return <div className="flex flex-wrap gap-1">{days.map(d=> <Badge key={d} variant="secondary" className="text-xs">{DAYS.find(day => day.value === d)?.label}</Badge>)}</div>;
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h2 className="text-xl font-semibold flex items-center gap-2"><Layers className="w-5 h-5"/> Plantillas de Agenda</h2>
				<Button onClick={()=> { form.reset(); setEditId(null); setOpenForm(true); }} className="gap-2"><Plus className="w-4 h-4"/> Nueva</Button>
			</div>

			<Card>
				<CardHeader className="pb-2"><CardTitle className="text-sm">Listado</CardTitle></CardHeader>
				<CardContent>
					{loading && <p className="text-sm text-muted-foreground">Cargando...</p>}
					{!loading && templates.length===0 && <p className="text-sm text-muted-foreground">Sin plantillas todavía.</p>}
					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
						{templates.map(tpl => (
							<div key={tpl.id} className="border rounded-md p-3 flex flex-col gap-2">
								<div className="flex items-start justify-between gap-2">
									<div>
										<h3 className="font-medium text-sm">{tpl.name}</h3>
										<p className="text-xs text-muted-foreground line-clamp-2">{tpl.description}</p>
									</div>
									<div className="flex gap-1">
										<Button size="icon" variant="ghost" className="h-8 w-8" onClick={()=>handleEdit(tpl)}><Edit2 className="w-4 h-4"/></Button>
										<Button size="icon" variant="ghost" className="h-8 w-8" onClick={()=>openBulkDialog(tpl)} title="Generar"><Calendar className="w-4 h-4"/></Button>
										<Button size="icon" variant="ghost" className="h-8 w-8" onClick={()=>duplicateTemplate(tpl)} title="Duplicar"><Copy className="w-4 h-4"/></Button>
										<Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={()=>handleDelete(tpl)}><Trash2 className="w-4 h-4"/></Button>
									</div>
								</div>
								{dayBadges(tpl)}
								<div className="text-[11px] text-muted-foreground flex flex-wrap gap-2">
									{tpl.doctor_name && <span>Dr: {tpl.doctor_name}</span>}
									{tpl.specialty_name && <span>Esp: {tpl.specialty_name}</span>}
									{tpl.location_name && <span>Sede: {tpl.location_name}</span>}
								</div>
								<div className="text-[11px] flex gap-2 flex-wrap">
									{JSON.parse(tpl.time_slots).map((s:any,i:number)=> <Badge key={i} variant="outline" className="text-[10px]">{s.start}-{s.end} x{s.capacity}</Badge>)}
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Dialogo Formulario */}
			<Dialog open={openForm} onOpenChange={setOpenForm}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>{editId? 'Editar Plantilla':'Nueva Plantilla'}</DialogTitle>
						<DialogDescription>Configure los parámetros de la plantilla.</DialogDescription>
					</DialogHeader>
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
							<div className="grid md:grid-cols-2 gap-4">
								<FormField control={form.control} name="name" render={({field}) => (
									<FormItem>
										<FormLabel>Nombre</FormLabel>
										<FormControl><Input {...field}/></FormControl>
										<FormMessage/>
									</FormItem>
								)}/>
								<FormField control={form.control} name="description" render={({field}) => (
									<FormItem>
										<FormLabel>Descripción</FormLabel>
										<FormControl><Input {...field}/></FormControl>
										<FormMessage/>
									</FormItem>
								)}/>
							</div>
							<div className="grid md:grid-cols-3 gap-4">
								<FormField control={form.control} name="doctor_id" render={({field}) => (
									<FormItem>
										<FormLabel>Doctor</FormLabel>
										<Select onValueChange={v=> field.onChange(v)} value={field.value? String(field.value): ''}>
											<FormControl><SelectTrigger><SelectValue placeholder="--"/></SelectTrigger></FormControl>
											<SelectContent>{doctors.map(d=> <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}</SelectContent>
										</Select>
									</FormItem>
								)}/>
								<FormField control={form.control} name="specialty_id" render={({field}) => (
									<FormItem>
										<FormLabel>Especialidad</FormLabel>
										<Select onValueChange={v=> field.onChange(v)} value={field.value? String(field.value): ''}>
											<FormControl><SelectTrigger><SelectValue placeholder="--"/></SelectTrigger></FormControl>
											<SelectContent>{specialties.map(s=> <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
										</Select>
									</FormItem>
								)}/>
								<FormField control={form.control} name="location_id" render={({field}) => (
									<FormItem>
										<FormLabel>Sede</FormLabel>
										<Select onValueChange={v=> field.onChange(v)} value={field.value? String(field.value): ''}>
											<FormControl><SelectTrigger><SelectValue placeholder="--"/></SelectTrigger></FormControl>
											<SelectContent>{locations.map(l=> <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}</SelectContent>
										</Select>
									</FormItem>
								)}/>
							</div>
							<div className="space-y-2">
								<FormLabel>Días de la semana</FormLabel>
								<div className="flex flex-wrap gap-2">
									{DAYS.map(d=> {
										const active = form.watch('days_of_week').includes(d.value);
										return <Button type="button" key={d.value} variant={active? 'default':'outline'} size="sm" onClick={()=>toggleDay(d.value)} className={cn('px-3', !active && 'bg-background')}>{d.label}</Button>;
									})}
								</div>
								<FormMessage>{form.formState.errors.days_of_week?.message as any}</FormMessage>
							</div>
							<div className="grid md:grid-cols-3 gap-4">
								<FormField control={form.control} name="duration_minutes" render={({field}) => (
									<FormItem>
										<FormLabel>Duración (min)</FormLabel>
										<FormControl><Input type="number" {...field}/></FormControl>
										<FormMessage/>
									</FormItem>
								)}/>
								<FormField control={form.control} name="break_between_slots" render={({field}) => (
									<FormItem>
										<FormLabel>Pausa (min)</FormLabel>
										<FormControl><Input type="number" {...field}/></FormControl>
										<FormMessage/>
									</FormItem>
								)}/>
								<FormField control={form.control} name="active" render={({field}) => (
									<FormItem className="flex flex-col justify-end">
										<FormLabel>Activa</FormLabel>
										<FormControl>
											<div className="flex items-center gap-2 mt-1">
												<Checkbox checked={field.value} onCheckedChange={v=> field.onChange(!!v)}/>
												<span className="text-xs text-muted-foreground">Disponible para generación</span>
											</div>
										</FormControl>
									</FormItem>
								)}/>
							</div>
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<FormLabel>Horarios</FormLabel>
									<Button type="button" size="sm" variant="outline" onClick={addTimeSlot}>Agregar</Button>
								</div>
								<div className="space-y-2">
									{form.watch('time_slots').map((slot,idx)=> (
										<div key={idx} className="grid md:grid-cols-5 gap-2 items-end">
											<div>
												<label className="text-xs">Inicio</label>
												<Input value={slot.start} onChange={e=> {
													const arr=[...form.getValues('time_slots')]; arr[idx].start=e.target.value; form.setValue('time_slots',arr);
												}}/>
											</div>
											<div>
												<label className="text-xs">Fin</label>
												<Input value={slot.end} onChange={e=> {
													const arr=[...form.getValues('time_slots')]; arr[idx].end=e.target.value; form.setValue('time_slots',arr);
												}}/>
											</div>
											<div>
												<label className="text-xs">Capacidad</label>
												<Input type="number" value={slot.capacity} onChange={e=> {
													const arr=[...form.getValues('time_slots')]; arr[idx].capacity= Number(e.target.value); form.setValue('time_slots',arr);
												}}/>
											</div>
											<div className="col-span-2 flex gap-2">
												<Button type="button" variant="ghost" size="sm" onClick={()=> removeTimeSlot(idx)} disabled={form.getValues('time_slots').length===1}>Eliminar</Button>
											</div>
										</div>
									))}
								</div>
								{form.formState.errors.time_slots && <p className="text-xs text-red-500">{(form.formState.errors.time_slots as any).message}</p>}
									{/* Distribución rápida opcional */}
									<div className="mt-4 border-t pt-4 space-y-2">
										<p className="text-xs font-semibold text-muted-foreground">Distribución rápida (opcional)</p>
										<div className="grid md:grid-cols-4 gap-2 items-end">
											<div className="md:col-span-2">
												<label className="text-xs">Rango (inicio)</label>
												<Input type="date" onChange={e=> (window as any)._distStart = e.target.value} />
											</div>
											<div>
												<label className="text-xs">Fin</label>
												<Input type="date" onChange={e=> (window as any)._distEnd = e.target.value} />
											</div>
											<div className="flex gap-2">
												<Button type="button" variant="outline" size="sm" onClick={async ()=> {
													const id = editId; if(!id) { toast.info('Primero guarde la plantilla'); return; }
													const start = (window as any)._distStart; const end = (window as any)._distEnd;
													if(!start || !end) { toast.error('Defina rango'); return; }
													try {
														await api.generateFromAgendaTemplate({ template_id: id, start_date:start, end_date:end, exclude_holidays:true });
														toast.success('Disponibilidades generadas');
													} catch(e:any){ toast.error(e.message||'Error generando'); }
												}}>Distribuir</Button>
											</div>
										</div>
										<p className="text-[10px] text-muted-foreground">Permite generar disponibilidades inmediatamente tras editar (usa excluir feriados). Para opciones avanzadas use el botón Generar del listado.</p>
									</div>
							</div>
							<div className="flex justify-end gap-2 pt-2">
								<Button type="button" variant="outline" onClick={()=> { setOpenForm(false); setEditId(null); }}>Cancelar</Button>
								<Button type="submit">{editId? 'Guardar Cambios':'Crear Plantilla'}</Button>
							</div>
						</form>
					</Form>
				</DialogContent>
			</Dialog>

			{/* Dialogo Generación Masiva */}
			<Dialog open={openBulk} onOpenChange={setOpenBulk}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Generar Disponibilidades</DialogTitle>
						<DialogDescription>Seleccione el rango de fechas para la generación.</DialogDescription>
					</DialogHeader>
					<Form {...bulkForm}>
						<form onSubmit={bulkForm.handleSubmit(submitBulk)} className="space-y-4">
							<div>
								<FormLabel>Plantilla</FormLabel>
								<p className="text-sm font-medium">{bulkTemplate?.name}</p>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<FormField control={bulkForm.control} name="start_date" render={({field}) => (
									<FormItem>
										<FormLabel>Inicio</FormLabel>
										<FormControl><Input type="date" {...field}/></FormControl>
										<FormMessage/>
									</FormItem>
								)}/>
								<FormField control={bulkForm.control} name="end_date" render={({field}) => (
									<FormItem>
										<FormLabel>Fin</FormLabel>
										<FormControl><Input type="date" {...field}/></FormControl>
										<FormMessage/>
									</FormItem>
								)}/>
							</div>
											<FormField control={bulkForm.control} name="exclude_holidays" render={({field}) => (
								<FormItem>
									<div className="flex items-center gap-2">
										<Checkbox checked={field.value} onCheckedChange={v=> field.onChange(!!v)}/>
										<FormLabel className="!mt-0">Excluir feriados</FormLabel>
									</div>
								</FormItem>
							)}/>
											<div className="flex items-center gap-2">
												<Checkbox defaultChecked onCheckedChange={(v)=> bulkForm.setValue('skip_existing', !!v)} />
												<span className="text-xs text-muted-foreground">Omitir si existe conflicto</span>
											</div>
							<div className="flex justify-end gap-2">
								<Button type="button" variant="outline" onClick={()=> setOpenBulk(false)}>Cancelar</Button>
								<Button type="submit" className="gap-2"><Calendar className="w-4 h-4"/> Generar</Button>
							</div>
						</form>
					</Form>
				</DialogContent>
			</Dialog>
		</div>
	);
}

