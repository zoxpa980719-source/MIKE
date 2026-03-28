"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { LumaSpin } from "@/components/ui/luma-spin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Mail,
  Phone,
  User,
  MessageSquare,
  CreditCard,
  Clock3,
  Crown,
  Building2,
  FileText,
} from "lucide-react";

type UserProfile = {
  uid: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
  role?: "employee" | "employer" | "admin";
  companyName?: string;
  firstName?: string;
  lastName?: string;
  contactNumber?: string;
  whatsapp?: string;
  wechat?: string;
  supportEmail?: string;
  plan?: string;
  serviceType?: string;
  notes?: string;
  budget?: string;
  [key: string]: unknown;
};

type OrderRecord = {
  id: string;
  itemName?: string;
  price?: string;
  date?: string;
  status?: string;
};

const PLAN_LABELS: Record<string, string> = {
  free: "免费版",
  starter: "基础版",
  pro: "专业版",
  premium: "高级版",
  business: "企业版",
};

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const id = params?.id as string;
  const isOwnProfile = user?.uid === id;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      try {
        const collectionName = isOwnProfile ? "users" : "publicProfiles";
        const docRef = doc(db, collectionName, id);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
          setProfile(null);
          return;
        }

        setProfile(snap.data() as UserProfile);

        const ordersQuery = query(collection(db, "orders"), where("userId", "==", id));
        const ordersSnap = await getDocs(ordersQuery);
        const orderRows: OrderRecord[] = ordersSnap.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<OrderRecord, "id">),
        }));
        setOrders(orderRows);
      } catch (error) {
        console.error("Failed to load profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, isOwnProfile]);

  const displayName = useMemo(() => {
    if (!profile) return "用户";
    if (profile.companyName) return profile.companyName;
    if (profile.displayName) return profile.displayName;
    const full = `${profile.firstName || ""} ${profile.lastName || ""}`.trim();
    return full || "用户";
  }, [profile]);

  const planLabel = PLAN_LABELS[profile?.plan || ""] || "未开通";

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center min-h-[60vh]">
        <LumaSpin />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto text-center py-20">
        <h1 className="text-2xl font-bold">资料不存在</h1>
        <Button variant="link" className="mt-4" onClick={() => router.push("/dashboard")}>
          返回控制台
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl pb-10 space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
      </div>

      <Card className="rounded-3xl border-gray-200">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border border-gray-200">
                <AvatarImage src={profile.photoURL} alt={displayName} />
                <AvatarFallback>{displayName.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
                <p className="text-sm text-muted-foreground">YINHNG 客户资料中心</p>
              </div>
            </div>
            <div className="flex gap-2">
              {isOwnProfile ? (
                <Button asChild variant="outline" className="rounded-full">
                  <Link href="/profile/edit">编辑资料</Link>
                </Button>
              ) : null}
              <Button asChild className="rounded-full">
                <Link href="/inbox">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  联系顾问
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader>
            <CardTitle>基础信息</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 text-sm">
            <div>
              <p className="text-muted-foreground">姓名 / 公司</p>
              <p className="font-medium mt-1">{displayName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">账户类型</p>
              <p className="font-medium mt-1 capitalize">{profile.role || "employee"}</p>
            </div>
            <div className="flex items-start gap-2">
              <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">邮箱</p>
                <p className="font-medium mt-1">{profile.email || "未填写"}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">联系电话</p>
                <p className="font-medium mt-1">{profile.contactNumber || "未填写"}</p>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground">WhatsApp</p>
              <p className="font-medium mt-1">{profile.whatsapp || "未填写"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">WeChat</p>
              <p className="font-medium mt-1">{profile.wechat || "未填写"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>服务状态</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">当前套餐</p>
              <p className="mt-1 font-semibold flex items-center gap-2">
                <Crown className="h-4 w-4" />
                {planLabel}
              </p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">服务订单</p>
              <p className="mt-1 font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                {orders.length} 笔
              </p>
            </div>
            <Button asChild className="w-full rounded-full">
              <Link href="/pricing">查看套餐</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>服务需求说明</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3 text-sm">
          <div className="rounded-xl border p-3">
            <p className="text-muted-foreground">目标服务</p>
            <p className="font-medium mt-1">{profile.serviceType || "待沟通"}</p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-muted-foreground">预算范围</p>
            <p className="font-medium mt-1">{profile.budget || "待沟通"}</p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-muted-foreground">备用客服邮箱</p>
            <p className="font-medium mt-1">{profile.supportEmail || "未填写"}</p>
          </div>
          <div className="rounded-xl border p-3 md:col-span-3">
            <p className="text-muted-foreground">备注</p>
            <p className="font-medium mt-1 whitespace-pre-wrap">{profile.notes || "暂无备注"}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>订单记录</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed py-10 text-center text-muted-foreground">
              暂无订单记录
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div key={order.id} className="rounded-xl border p-4 grid gap-3 md:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">服务名称</p>
                    <p className="font-medium mt-1">{order.itemName || "服务套餐"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">金额</p>
                    <p className="font-medium mt-1">{order.price || "--"}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock3 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">下单时间</p>
                      <p className="font-medium mt-1">{order.date || "待确认"}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">状态</p>
                    <Badge className="mt-1" variant="secondary">{order.status || "处理中"}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
